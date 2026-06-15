package docker

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/errdefs"
)

// ContainerLogLine is one stdout/stderr line from a container.
type ContainerLogLine struct {
	Stream string    `json:"stream"`
	Line   string    `json:"line"`
	Time   time.Time `json:"time"`
}

// StreamContainerLogs tails container stdout/stderr. Invokes fn for each line until ctx is done.
func (c *RealClient) StreamContainerLogs(ctx context.Context, tail int, follow bool, names []string, fn func(ContainerLogLine) error) error {
	if tail <= 0 {
		tail = 200
	}
	if tail > 2000 {
		tail = 2000
	}

	var containerName string
	for _, name := range uniqueContainerNames(names) {
		st, err := c.inspectOne(ctx, name)
		if err != nil {
			return err
		}
		if st.Found {
			containerName = name
			break
		}
	}
	if containerName == "" {
		return fmt.Errorf("container not found")
	}

	tailStr := fmt.Sprintf("%d", tail)
	reader, err := c.cli.ContainerLogs(ctx, containerName, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     follow,
		Tail:       tailStr,
		Timestamps: true,
	})
	if err != nil {
		if errdefs.IsNotFound(err) {
			return fmt.Errorf("container not found")
		}
		return fmt.Errorf("container logs: %w", err)
	}
	defer reader.Close()

	return readMultiplexedLogs(ctx, reader, fn)
}

func readMultiplexedLogs(ctx context.Context, reader io.Reader, fn func(ContainerLogLine) error) error {
	hdr := make([]byte, 8)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		if _, err := io.ReadFull(reader, hdr); err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}

		size := binary.BigEndian.Uint32(hdr[4:8])
		if size == 0 {
			continue
		}
		payload := make([]byte, size)
		if _, err := io.ReadFull(reader, payload); err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}

		stream := "stdout"
		if hdr[0] == 2 {
			stream = "stderr"
		}

		line := string(payload)
		if line == "" {
			continue
		}
		// Docker timestamps prefix when Timestamps: true — keep raw line for simplicity.
		if err := fn(ContainerLogLine{
			Stream: stream,
			Line:   trimLogLine(line),
			Time:   time.Now().UTC(),
		}); err != nil {
			return err
		}
	}
}

func trimLogLine(s string) string {
	s = strings.TrimSuffix(s, "\n")
	if len(s) < 31 || s[10] != 'T' {
		return s
	}
	if i := strings.Index(s, "Z "); i >= 0 {
		return s[i+2:]
	}
	if i := strings.Index(s, " "); i > 10 && i < 40 {
		return strings.TrimSpace(s[i+1:])
	}
	return s
}

// StreamContainerLogs stub emits sample lines.
func (s *StubClient) StreamContainerLogs(ctx context.Context, tail int, follow bool, names []string, fn func(ContainerLogLine) error) error {
	_ = tail
	_ = follow
	_ = names
	lines := []string{
		"[stub] container started",
		"[stub] listening for requests",
	}
	for _, line := range lines {
		if err := fn(ContainerLogLine{Stream: "stdout", Line: line, Time: time.Now().UTC()}); err != nil {
			return err
		}
	}
	<-ctx.Done()
	return ctx.Err()
}

// MarshalLogLine JSON for SSE.
func MarshalLogLine(seq int64, line ContainerLogLine) ([]byte, error) {
	type payload struct {
		Seq    int64  `json:"seq"`
		Stream string `json:"stream"`
		Line   string `json:"line"`
		Time   string `json:"time"`
	}
	return json.Marshal(payload{
		Seq:    seq,
		Stream: line.Stream,
		Line:   line.Line,
		Time:   line.Time.Format(time.RFC3339Nano),
	})
}
