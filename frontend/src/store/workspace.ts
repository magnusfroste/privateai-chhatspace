import { create } from 'zustand'
import type { Workspace, Chat } from '../lib/api'

export type { Workspace, Chat }

interface WorkspaceState {
  workspaces: Workspace[]
  currentWorkspace: Workspace | null
  chats: Chat[]
  currentChat: Chat | null
  setWorkspaces: (workspaces: Workspace[]) => void
  setCurrentWorkspace: (workspace: Workspace | null) => void
  setChats: (chats: Chat[]) => void
  setCurrentChat: (chat: Chat | null) => void
  addWorkspace: (workspace: Workspace) => void
  addChat: (chat: Chat) => void
  removeChat: (chatId: number) => void
  removeWorkspace: (workspaceId: number) => void
  updateWorkspace: (workspace: Workspace) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  currentWorkspace: null,
  chats: [],
  currentChat: null,
  setWorkspaces: (workspaces) => set({ workspaces }),
  setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace, currentChat: null }),
  setChats: (chats) => set({ chats }),
  setCurrentChat: (chat) => set({ currentChat: chat }),
  addWorkspace: (workspace) => set((state) => ({ 
    workspaces: [...state.workspaces, workspace],
    currentWorkspace: workspace
  })),
  addChat: (chat) => set((state) => ({ chats: [chat, ...state.chats] })),
  removeChat: (chatId) => set((state) => ({ 
    chats: state.chats.filter(c => c.id !== chatId),
    currentChat: state.currentChat?.id === chatId ? null : state.currentChat
  })),
  removeWorkspace: (workspaceId) => set((state) => {
    const newWorkspaces = state.workspaces.filter(w => w.id !== workspaceId)
    const isCurrentDeleted = state.currentWorkspace?.id === workspaceId
    return {
      workspaces: newWorkspaces,
      currentWorkspace: isCurrentDeleted ? (newWorkspaces[0] || null) : state.currentWorkspace,
      chats: isCurrentDeleted ? [] : state.chats,
      currentChat: isCurrentDeleted ? null : state.currentChat
    }
  }),
  updateWorkspace: (workspace) => set((state) => ({
    workspaces: state.workspaces.map(w => w.id === workspace.id ? workspace : w),
    currentWorkspace: state.currentWorkspace?.id === workspace.id ? workspace : state.currentWorkspace
  })),
}))
