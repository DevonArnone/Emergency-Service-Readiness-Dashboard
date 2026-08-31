"""Configuration management using environment variables."""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Kafka Configuration (optional - uses mock service if not provided)
    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_username: str = "placeholder"
    kafka_password: str = "placeholder"
    kafka_topic: str = "ops.events.v1"
    kafka_alert_topic: str = "ops.alerts.v1"
    kafka_event_topic: str = "ops.events.v1"
    kafka_audit_topic: str = "ops.audit.v1"
    kafka_shared_topic: str = "ops.shared.v1"
    kafka_alert_dlq_topic: str = "ops.alerts.dlq.v1"
    kafka_event_dlq_topic: str = "ops.events.dlq.v1"
    kafka_alert_partitions: int = 6
    kafka_event_partitions: int = 12
    kafka_audit_partitions: int = 6
    kafka_shared_partitions: int = 3
    kafka_replication_factor: int = 1
    kafka_client_id: str = "aegis-api"
    pipeline_profile: str = "optimized"
    
    # Snowflake Configuration (optional - uses mock service if not provided)
    # Get account identifier from Snowflake UI: Username → Account
    # Format: account.region (e.g., abc12345.us-east-1)
    snowflake_account: str = "placeholder"
    snowflake_user: str = "placeholder"
    snowflake_password: str = "placeholder"
    snowflake_role: str = "ACCOUNTADMIN"
    snowflake_warehouse: str = "COMPUTE_WH"
    snowflake_database: str = "WORKFORCE_DB"
    snowflake_schema: str = "RAW"
    
    # Application Configuration
    app_env: str = "development"
    jwt_secret: str = "dev-secret-key-change-in-production"
    cors_origins: str = "http://localhost:3000"
    trusted_hosts: str = "localhost,127.0.0.1,testserver"
    database_url: str = "sqlite+pysqlite:///./aegis.db"
    state_database_path: str = "./emergency_readiness.db"
    default_organization_id: str = "fcfrd-demo"
    seed_demo_on_empty: bool = True
    auto_create_schema: bool = True
    public_demo_write_enabled: bool = False

    # Identity Configuration
    auth_required: bool = False
    oidc_issuer: str = ""
    oidc_discovery_url: str = ""
    oidc_audience: str = "aegis-api"
    oidc_algorithms: str = "RS256"
    jwks_cache_seconds: int = 300
    realtime_ticket_ttl_seconds: int = 30

    # Realtime fan-out
    redis_url: str = "redis://localhost:6379/0"
    redis_fanout_enabled: bool = False
    
    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8000
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def trusted_hosts_list(self) -> List[str]:
        return [host.strip() for host in self.trusted_hosts.split(",") if host.strip()]

    @property
    def oidc_algorithms_list(self) -> List[str]:
        return [algorithm.strip() for algorithm in self.oidc_algorithms.split(",") if algorithm.strip()]

    def validate_runtime(self) -> None:
        if self.app_env != "production":
            return
        problems = []
        if not self.auth_required:
            problems.append("AUTH_REQUIRED must be enabled")
        if not self.oidc_issuer.startswith("https://"):
            problems.append("OIDC_ISSUER must use HTTPS")
        if self.jwt_secret == "dev-secret-key-change-in-production":
            problems.append("JWT_SECRET must not use the development value")
        if self.database_url.startswith("sqlite"):
            problems.append("DATABASE_URL must use PostgreSQL")
        if "*" in self.cors_origins_list:
            problems.append("CORS_ORIGINS must not contain a wildcard")
        if self.public_demo_write_enabled:
            problems.append("PUBLIC_DEMO_WRITE_ENABLED must be disabled")
        if problems:
            raise RuntimeError("Unsafe production configuration: " + "; ".join(problems))
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
