package system

import (
	"os"
	"testing"
)

func TestTopByCPUAndMem(t *testing.T) {
	procs := []ProcessInfo{
		{PID: 1, CPUPercent: 1, RSSBytes: 100, MemPercent: 1},
		{PID: 2, CPUPercent: 50, RSSBytes: 200, MemPercent: 2},
		{PID: 3, CPUPercent: 10, RSSBytes: 900, MemPercent: 9},
	}
	cpu := topByCPU(procs, 1)
	if cpu[0].PID != 2 {
		t.Fatalf("cpu top=%d", cpu[0].PID)
	}
	mem := topByMem(procs, 1)
	if mem[0].PID != 3 {
		t.Fatalf("mem top=%d", mem[0].PID)
	}
}

func TestFormatBytes(t *testing.T) {
	if got := FormatBytes(1536); got != "1.5 KiB" {
		t.Fatalf("got %q", got)
	}
}

func TestReadProcSampleSelf(t *testing.T) {
	pid := os.Getpid()
	s, err := readProcSample(pid)
	if err != nil {
		t.Skipf("proc not available in this environment: %v", err)
	}
	if s.pid != pid {
		t.Fatalf("pid %d", s.pid)
	}
	if s.comm == "" && s.cmdline == "" {
		t.Fatal("empty command")
	}
}

func TestDiskUsageRoot(t *testing.T) {
	d, err := diskUsage("/", "/")
	if err != nil {
		t.Fatal(err)
	}
	if d.TotalBytes == 0 {
		t.Fatal("total 0")
	}
}
