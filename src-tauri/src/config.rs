use serde::Deserialize;

use std::{
    env,
    fs,
    path::{PathBuf},
};


#[derive(Debug, Deserialize)]
pub struct MiniConfig {
    pub  user:  MiniUserConfig
}
#[derive(Debug, Deserialize)]
pub struct MiniUserConfig {
    pub  profile_order: Vec<String>,
}

fn config_dir() -> PathBuf {
    env::var("CONFIG_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/meticulous-user/config"))
}


pub fn parse_config() -> Result<MiniConfig, Box<dyn std::error::Error>> {
    let config_path = config_dir().join("config.yml");
    let contents = fs::read_to_string(&config_path)?;
    let config: MiniConfig = serde_yaml::from_str(&contents)
        .expect("Failed to parse config.yml");

    Ok(config)
}