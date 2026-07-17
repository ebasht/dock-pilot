package docker

import (
	"context"
	"fmt"
	"log/slog"
)

// BuildOptions describes a Docker image build.
type BuildOptions struct {
	ContextDir     string // local path with repository contents
	RepoURL        string
	Branch         string
	DockerfilePath string
	BuildContext   string
	ImageTag       string
}

// RunOptions describes starting a container.
type RunOptions struct {
	ImageTag      string
	ContainerName string   // name for the new container (usually site slug)
	StopNames     []string // slug + URL host names to stop before start
	HostPort      int
	ContainerPort int
	Env           map[string]string
	PublishPorts   bool // false for Telegram bots (long polling, no HTTP)
	Mounts         []Mount
	EnsureVolumes  []string // named Docker volumes to create before run
	NetworkHost    bool     // docker network_mode: host
}

// Client manages Docker builds and containers.
type Client interface {
	Build(ctx context.Context, opts BuildOptions) error
	Run(ctx context.Context, opts RunOptions) (containerID string, err error)
	Stop(ctx context.Context, containerNames ...string) error
	AllocatePort(ctx context.Context) (int, error)
	InspectContainer(ctx context.Context, names ...string) (ContainerStatus, error)
	StreamContainerLogs(ctx context.Context, tail int, follow bool, names []string, fn func(ContainerLogLine) error) error
	Prune(ctx context.Context) (PruneResult, error)
	DiskUsage(ctx context.Context) (DiskUsageSnapshot, error)
}

// StubClient logs actions without touching Docker.
type StubClient struct {
	logger *slog.Logger
}

func NewStubClient(logger *slog.Logger) *StubClient {
	if logger == nil {
		logger = slog.Default()
	}
	return &StubClient{logger: logger}
}

func (s *StubClient) Build(ctx context.Context, opts BuildOptions) error {
	s.logger.InfoContext(ctx, "stub docker build",
		"repo", opts.RepoURL,
		"branch", opts.Branch,
		"dockerfile", opts.DockerfilePath,
		"tag", opts.ImageTag,
	)
	return nil
}

func (s *StubClient) Run(ctx context.Context, opts RunOptions) (string, error) {
	s.logger.InfoContext(ctx, "stub docker run",
		"image", opts.ImageTag,
		"name", opts.ContainerName,
		"host_port", opts.HostPort,
		"container_port", opts.ContainerPort,
		"mounts", len(opts.Mounts),
		"volumes", opts.EnsureVolumes,
		"network_host", opts.NetworkHost,
	)
	return fmt.Sprintf("stub-%s", opts.ContainerName), nil
}

func (s *StubClient) Stop(ctx context.Context, containerNames ...string) error {
	s.logger.InfoContext(ctx, "stub docker stop", "names", containerNames)
	return nil
}

func (s *StubClient) AllocatePort(ctx context.Context) (int, error) {
	// MVP: deterministic stub port in high range.
	s.logger.InfoContext(ctx, "stub allocate port")
	return 18080, nil
}
