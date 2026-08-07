use dabar_core::Sermon;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

#[derive(Clone, Default)]
pub struct AppState {
    sermons: Arc<Mutex<HashMap<Uuid, Sermon>>>,
}

impl AppState {
    pub fn insert_sermon(&self, sermon: Sermon) -> Sermon {
        let mut sermons = self.sermons.lock().expect("sermon state lock poisoned");
        sermons.insert(sermon.id, sermon.clone());
        sermon
    }

    pub fn list_sermons(&self) -> Vec<Sermon> {
        let sermons = self.sermons.lock().expect("sermon state lock poisoned");
        let mut values: Vec<Sermon> = sermons.values().cloned().collect();
        values.sort_by(|left, right| right.created_at.cmp(&left.created_at));
        values
    }

    pub fn get_sermon(&self, id: Uuid) -> Option<Sermon> {
        let sermons = self.sermons.lock().expect("sermon state lock poisoned");
        sermons.get(&id).cloned()
    }
}
