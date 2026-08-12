from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Mov!n Matching API"
    cors_origins: str = "http://localhost:5173,http://localhost:5174"
    matching_data_file: str = ""
    matching_model_dir: str = ""
    feedback_file: str = "data/matching_feedback.jsonl"
    allow_demo_data: bool = True

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def repository_root(self) -> Path:
        return Path(__file__).resolve().parents[3]

    @property
    def matching_data_path(self) -> Path:
        if self.matching_data_file:
            return Path(self.matching_data_file).expanduser().resolve()
        return self.repository_root / "ai" / "data" / "유연오더_가상데이터_v13.xlsx"

    @property
    def matching_model_path(self) -> Path:
        if self.matching_model_dir:
            return Path(self.matching_model_dir).expanduser().resolve()
        return self.repository_root / "ai" / "data" / "out" / "models"

    @property
    def feedback_path(self) -> Path:
        path = Path(self.feedback_file).expanduser()
        if path.is_absolute():
            return path
        return self.repository_root / "backend" / path


settings = Settings()
