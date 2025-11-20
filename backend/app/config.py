"""Configuration management using environment variables."""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Kafka Configuration (optional - uses mock service if not provided)
    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_username: str = "placeholder"
    kafka_password: str = "placeholder"
    kafka_topic: str = "shift_events"
    
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
    jwt_secret: str = "dev-secret-key-change-in-production"
    cors_origins: str = "http://localhost:3000"
    database_url: str = "sqlite+aiosqlite:///./workforce.db"
    
    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8000
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",")]
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()

