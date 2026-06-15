package docker

import (
	"context"
	"strings"

	"github.com/docker/docker/errdefs"
)

// ContainerStatus describes a running (or missing) container on the host.
type ContainerStatus struct {
	Found      bool   `json:"found"`
	Running    bool   `json:"running"`
	State      string `json:"state"`
	Health     string `json:"health"` // none, starting, healthy, unhealthy
	Container  string `json:"container"`
}

// InspectContainer looks up a container by name (tries each candidate until found).
func (c *RealClient) InspectContainer(ctx context.Context, names ...string) (ContainerStatus, error) {
	for _, name := range uniqueContainerNames(names) {
		st, err := c.inspectOne(ctx, name)
		if err != nil {
			return ContainerStatus{}, err
		}
		if st.Found {
			st.Container = name
			return st, nil
		}
	}
	return ContainerStatus{Health: "none"}, nil
}

func (c *RealClient) inspectOne(ctx context.Context, name string) (ContainerStatus, error) {
	info, err := c.cli.ContainerInspect(ctx, name)
	if err != nil {
		if errdefs.IsNotFound(err) {
			return ContainerStatus{Health: "none"}, nil
		}
		return ContainerStatus{}, err
	}

	st := ContainerStatus{
		Found:   true,
		State:   info.State.Status,
		Running: info.State.Running,
		Health:  "none",
	}
	if info.State.Health != nil {
		st.Health = info.State.Health.Status
	}
	return st, nil
}

// InspectContainer stub: no real Docker state.
func (s *StubClient) InspectContainer(ctx context.Context, names ...string) (ContainerStatus, error) {
	n := uniqueContainerNames(names)
	if len(n) == 0 {
		return ContainerStatus{Health: "none"}, nil
	}
	return ContainerStatus{
		Found:     true,
		Running:   true,
		State:     "running",
		Health:    "none",
		Container: n[0],
	}, nil
}

// ContainerNamesForSite returns names to inspect for a site.
func ContainerNamesForSite(slug, primaryURL string) []string {
	_, stopNames := NamesForSite(slug, primaryURL)
	return stopNames
}

// IsContainerRunning reports whether inspect result means the process is up.
func IsContainerRunning(st ContainerStatus) bool {
	return st.Found && st.Running && st.State == "running"
}

// DockerHealthOK is true when there is no HEALTHCHECK or it reports healthy.
func DockerHealthOK(st ContainerStatus) bool {
	h := strings.ToLower(strings.TrimSpace(st.Health))
	return h == "" || h == "none" || h == "healthy"
}
