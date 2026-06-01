package git

import (
	"testing"
)

func TestInjectHTTPToken(t *testing.T) {
	got, err := injectHTTPToken("https://github.com/org/repo.git", "ghp_secret")
	if err != nil {
		t.Fatal(err)
	}
	want := "https://x-access-token:ghp_secret@github.com/org/repo.git"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestIsSSHRepoURL(t *testing.T) {
	if !isSSHRepoURL("git@github.com:org/repo.git") {
		t.Fatal("expected ssh url")
	}
	if isSSHRepoURL("https://github.com/org/repo.git") {
		t.Fatal("expected https not ssh")
	}
}

func TestTokenFromSecrets(t *testing.T) {
	if got := TokenFromSecrets(map[string]string{"GITHUB_TOKEN": "tok"}); got != "tok" {
		t.Fatalf("got %q", got)
	}
}
