package nginx

import "testing"

func TestConfigDeclaresDomain(t *testing.T) {
	content := `server {
    listen 80;
    server_name test.eugen-bash.com www.test.eugen-bash.com;
}`
	if !configDeclaresDomain(content, "test.eugen-bash.com") {
		t.Fatal("expected primary domain match")
	}
	if !configDeclaresDomain(content, "www.test.eugen-bash.com") {
		t.Fatal("expected alias match")
	}
	if configDeclaresDomain(content, "other.example.com") {
		t.Fatal("unexpected match")
	}
}

func TestNginxConfHasActiveHashBucket(t *testing.T) {
	if nginxConfHasActiveHashBucket("# server_names_hash_bucket_size 64;") {
		t.Fatal("commented line should not count")
	}
	if !nginxConfHasActiveHashBucket("server_names_hash_bucket_size 128;") {
		t.Fatal("active directive should match")
	}
}
