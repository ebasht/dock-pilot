package docker

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
)

// PruneResult summarizes space recovered by Docker cleanup.
type PruneResult struct {
	ContainersDeleted int    `json:"containers_deleted"`
	ImagesDeleted     int    `json:"images_deleted"`
	SpaceReclaimed    uint64 `json:"space_reclaimed"`
}

// ImageUsageRow is one local image for the disk breakdown UI.
type ImageUsageRow struct {
	ID         string   `json:"id"`
	Tags       []string `json:"tags"`
	SizeBytes  uint64   `json:"size_bytes"`  // unique contribution when SharedSize known
	TotalBytes uint64   `json:"total_bytes"` // full image size (includes shared layers)
	InUse      bool     `json:"in_use"`
	Dangling   bool     `json:"dangling"`
}

// DiskUsageSnapshot is a compact view of Docker disk consumption.
type DiskUsageSnapshot struct {
	// ImagesBytes is unique layer storage (LayersSize), not a sum of per-image Size.
	ImagesBytes      uint64          `json:"images_bytes"`
	ContainersBytes  uint64          `json:"containers_bytes"`
	VolumesBytes     uint64          `json:"volumes_bytes"`
	BuildCacheBytes  uint64          `json:"build_cache_bytes"`
	ReclaimableBytes uint64          `json:"reclaimable_bytes"`
	ImageCount       int             `json:"image_count"`
	UnusedImageCount int             `json:"unused_image_count"`
	TopImages        []ImageUsageRow `json:"top_images"`
}

// Prune removes stopped containers, unused images (including tagged), and build cache.
// Images still referenced by any container (running or stopped) are kept.
func (c *RealClient) Prune(ctx context.Context) (PruneResult, error) {
	var out PruneResult

	c.logger.InfoContext(ctx, "docker prune starting")

	containers, err := c.cli.ContainersPrune(ctx, filters.NewArgs())
	if err != nil {
		return out, fmt.Errorf("containers prune: %w", err)
	}
	out.ContainersDeleted = len(containers.ContainersDeleted)
	out.SpaceReclaimed += containers.SpaceReclaimed

	// Untagged (dangling) leftovers from retags.
	dangling, err := c.cli.ImagesPrune(ctx, filters.NewArgs(filters.Arg("dangling", "true")))
	if err != nil {
		return out, fmt.Errorf("dangling images prune: %w", err)
	}
	out.ImagesDeleted += len(dangling.ImagesDeleted)
	out.SpaceReclaimed += dangling.SpaceReclaimed

	// All images not used by any container (dangling=false).
	unused, err := c.cli.ImagesPrune(ctx, filters.NewArgs(filters.Arg("dangling", "false")))
	if err != nil {
		return out, fmt.Errorf("unused images prune: %w", err)
	}
	out.ImagesDeleted += len(unused.ImagesDeleted)
	out.SpaceReclaimed += unused.SpaceReclaimed

	cache, err := c.cli.BuildCachePrune(ctx, types.BuildCachePruneOptions{All: true})
	if err != nil {
		return out, fmt.Errorf("build cache prune: %w", err)
	}
	out.SpaceReclaimed += cache.SpaceReclaimed

	c.logger.InfoContext(ctx, "docker prune finished",
		"containers_deleted", out.ContainersDeleted,
		"images_deleted", out.ImagesDeleted,
		"space_reclaimed", out.SpaceReclaimed,
	)
	return out, nil
}

func (c *RealClient) DiskUsage(ctx context.Context) (DiskUsageSnapshot, error) {
	var out DiskUsageSnapshot
	du, err := c.cli.DiskUsage(ctx, types.DiskUsageOptions{})
	if err != nil {
		return out, fmt.Errorf("docker disk usage: %w", err)
	}

	// LayersSize is the real on-disk size of image layers (no double-counting).
	if du.LayersSize > 0 {
		out.ImagesBytes = uint64(du.LayersSize)
	}

	rows := make([]ImageUsageRow, 0, len(du.Images))
	var reclaimableUnique uint64
	for _, img := range du.Images {
		if img == nil {
			continue
		}
		out.ImageCount++
		inUse := img.Containers > 0
		if !inUse {
			out.UnusedImageCount++
		}

		tags := img.RepoTags
		dangling := len(tags) == 0 || (len(tags) == 1 && tags[0] == "<none>:<none>")
		if dangling {
			tags = []string{"<none>"}
		}

		total := uint64(0)
		if img.Size > 0 {
			total = uint64(img.Size)
		}
		unique := total
		if img.SharedSize >= 0 && uint64(img.SharedSize) < total {
			unique = total - uint64(img.SharedSize)
		}
		if !inUse {
			reclaimableUnique += unique
		}

		id := img.ID
		if strings.HasPrefix(id, "sha256:") && len(id) > 19 {
			id = id[7:19]
		}
		rows = append(rows, ImageUsageRow{
			ID:         id,
			Tags:       tags,
			SizeBytes:  unique,
			TotalBytes: total,
			InUse:      inUse,
			Dangling:   dangling,
		})
	}

	if out.ImagesBytes == 0 {
		// Fallback if LayersSize missing: sum unique contributions.
		var sum uint64
		for _, r := range rows {
			sum += r.SizeBytes
		}
		out.ImagesBytes = sum
	}

	for _, ctr := range du.Containers {
		if ctr == nil {
			continue
		}
		out.ContainersBytes += uint64(ctr.SizeRw)
	}
	for _, vol := range du.Volumes {
		if vol == nil {
			continue
		}
		out.VolumesBytes += uint64(vol.UsageData.Size)
		if vol.UsageData.RefCount == 0 {
			out.ReclaimableBytes += uint64(vol.UsageData.Size)
		}
	}
	for _, layer := range du.BuildCache {
		if layer == nil {
			continue
		}
		out.BuildCacheBytes += uint64(layer.Size)
		if !layer.InUse {
			out.ReclaimableBytes += uint64(layer.Size)
		}
	}
	out.ReclaimableBytes += reclaimableUnique

	sort.Slice(rows, func(i, j int) bool {
		if rows[i].SizeBytes != rows[j].SizeBytes {
			return rows[i].SizeBytes > rows[j].SizeBytes
		}
		return rows[i].TotalBytes > rows[j].TotalBytes
	})
	const topN = 15
	if len(rows) > topN {
		rows = rows[:topN]
	}
	out.TopImages = rows
	return out, nil
}

func (s *StubClient) Prune(ctx context.Context) (PruneResult, error) {
	s.logger.InfoContext(ctx, "stub docker prune")
	return PruneResult{}, nil
}

func (s *StubClient) DiskUsage(ctx context.Context) (DiskUsageSnapshot, error) {
	s.logger.InfoContext(ctx, "stub docker disk usage")
	return DiskUsageSnapshot{}, nil
}
