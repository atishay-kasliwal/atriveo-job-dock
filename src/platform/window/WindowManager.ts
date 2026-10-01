import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

class WindowManager {
  async show(): Promise<void> {
    await invoke('show_window')
  }

  async hide(): Promise<void> {
    await invoke('hide_window')
  }

  async togglePin(): Promise<void> {
    await invoke('toggle_always_on_top')
  }

  listenForShortcut(): void {
    listen<{ id?: string }>('tauri://menu', (event) => {
      if (event.payload.id === 'show') void this.show()
    })
  }
}

export const windowManager = new WindowManager()
