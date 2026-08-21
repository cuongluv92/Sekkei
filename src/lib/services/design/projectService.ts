import { delay } from "@/lib/utils/async";
import type { Project } from "@/lib/types/design";
import { loadFromStorage, saveToStorage } from "@/lib/utils/localStore";

const STORAGE_KEY = "sekkei.design.projects";

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `proj-${Date.now()}-${idCounter}`;
}

function loadAll(): Project[] {
  return loadFromStorage<Project[]>(STORAGE_KEY, [
    { id: "proj-sample", name: "サンプルプロジェクト", createdAt: "2026-01-06" },
  ]);
}

export const projectService = {
  async list(): Promise<Project[]> {
    return delay([...loadAll()].sort((a, b) => a.name.localeCompare(b.name, "ja")), 150);
  },

  async getById(id: string): Promise<Project | null> {
    return delay(loadAll().find((p) => p.id === id) ?? null, 100);
  },

  async create(name: string): Promise<Project> {
    const all = loadAll();
    const project: Project = {
      id: nextId(),
      name: name.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
    };
    all.push(project);
    saveToStorage(STORAGE_KEY, all);
    return delay(project, 200);
  },
};
