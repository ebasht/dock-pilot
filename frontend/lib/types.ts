export interface SiteListItem {
  id: string;
  name: string;
  slug: string;
  site_type: string;
  primary_url: string;
  status: string;
  updated_at: string;
}

export interface SiteHealthContainer {
  found: boolean;
  running: boolean;
  state: string;
  health: string;
  container?: string;
}

export interface SiteHealthHTTP {
  url: string;
  status_code?: number;
  ok: boolean;
  error?: string;
}

export interface ContainerLogLine {
  seq: number;
  stream: string;
  line: string;
  time: string;
}

export interface SiteHealth {
  site_id: string;
  site_type: string;
  overall: string;
  message: string;
  container?: SiteHealthContainer;
  http?: SiteHealthHTTP;
  checked_at: string;
}

export interface Domain {
  id?: string;
  domain: string;
  is_primary: boolean;
}

export interface EnvVar {
  key: string;
  value: string;
}

export type SiteType = "web" | "telegram_bot";

export interface Site {
  id: string;
  name: string;
  slug: string;
  site_type: SiteType;
  primary_url: string;
  git_repo_url: string;
  git_branch: string;
  dockerfile_path: string;
  build_context: string;
  container_port: number;
  host_port?: number;
  nginx_ssl_enabled: boolean;
  nginx_force_https: boolean;
  docker_volume_mounts: string[];
  docker_named_volumes: string[];
  docker_network_host: boolean;
  status: string;
  domains: Domain[];
  env_vars: EnvVar[];
  created_at: string;
  updated_at: string;
}

export interface CreateSiteRequest {
  name: string;
  slug?: string;
  site_type?: SiteType;
  primary_url: string;
  git_repo_url: string;
  git_branch?: string;
  dockerfile_path?: string;
  build_context?: string;
  container_port?: number;
  nginx_ssl_enabled?: boolean;
  nginx_force_https?: boolean;
  docker_volume_mounts?: string[];
  docker_named_volumes?: string[];
  docker_network_host?: boolean;
  domains?: { domain: string; is_primary: boolean }[];
  env_vars?: EnvVar[];
}

export interface SecretMeta {
  key: string;
  created_at: string;
  updated_at: string;
}

export interface Deployment {
  id: string;
  site_id: string;
  status: string;
  message: string;
  started_at?: string;
  finished_at?: string;
  created_at: string;
}

export interface DeploymentLog {
  id: number;
  level: string;
  message: string;
  created_at: string;
}

export interface WizardState {
  siteType: SiteType;
  name: string;
  slug: string;
  primaryUrl: string;
  gitRepoUrl: string;
  gitBranch: string;
  dockerfilePath: string;
  buildContext: string;
  containerPort: number;
  dockerNetworkHost: boolean;
  envVars: EnvVar[];
  secrets: EnvVar[];
  aliases: string[];
  nginxSslEnabled: boolean;
  nginxForceHttps: boolean;
}
