package docker

import (
	"context"
	"fmt"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
)

// PruneResult summarizes space recovered by Docker cleanup.
type PruneResult struct {
	ContainersDeleted int    `json:"containers_deleted"`
	ImagesDeleted     int    `json:"images_deleted"`
	SpaceReclaimed    uint64 `json:"space_reclaimed"`
}

// DiskUsageSnapshot is a compact view of Docker disk consumption.
type DiskUsageSnapshot struct {
	ImagesBytes      uint64 `json:"images_bytes"`
	ContainersBytes  uint64 `json:"containers_bytes"`
	VolumesBytes     uint64 `json:"volumes_bytes"`
	BuildCacheBytes  uint64 `json:"build_cache_bytes"`
	ReclaimableBytes uint64 `json:"reclaimable_bytes"`
}

// Prune removes stopped containers, dangling images, and build cache.
// Safe for running sites: tagged images still referenced by containers are kept.
func (c *RealClient) Prune(ctx context.Context) (PruneResult, error) {
	var out PruneResult

	c.logger.InfoContext(ctx, "docker prune starting")

	containers, err := c.cli.ContainersPrune(ctx, filters.NewArgs())
	if err != nil {
		return out, fmt.Errorf("containers prune: %w", err)
	}
	out.ContainersDeleted = len(containers.ContainersDeleted)
	out.SpaceReclaimed += containers.SpaceReclaimed

	images, err := c.cli.ImagesPrune(ctx, filters.NewArgs(filters.Arg("dangling", "true")))
	if err != nil {
		return out, fmt.Errorf("images prune: %w", err)
	}
	out.ImagesDeleted = len(images.ImagesDeleted)
	out.SpaceReclaimed += images.SpaceReclaimed

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

	for _, img := range du.Images {
		if img == nil {
			continue
		}
		out.ImagesBytes += uint64(img.Size)
		if img.Containers == 0 {
			out.ReclaimableBytes += uint64(img.Size)
		}
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
