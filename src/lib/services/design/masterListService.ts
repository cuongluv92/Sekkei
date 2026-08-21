import type { MasterListItem } from "@/lib/types/design";
import { masterListRepository } from "./masterListRepository";

export const masterListService = {
  listKeys(): Promise<string[]> {
    return masterListRepository.listKeys();
  },
  listByKey(listKey: string, includeDisabled = false): Promise<MasterListItem[]> {
    return masterListRepository.listByKey(listKey, includeDisabled);
  },
  add(listKey: string, value: string): Promise<MasterListItem> {
    return masterListRepository.add(listKey, value);
  },
  update(id: string, value: string): Promise<void> {
    return masterListRepository.update(id, value);
  },
  remove(id: string): Promise<void> {
    return masterListRepository.remove(id);
  },
  toggleEnabled(id: string): Promise<void> {
    return masterListRepository.toggleEnabled(id);
  },
  move(id: string, direction: "up" | "down"): Promise<void> {
    return masterListRepository.move(id, direction);
  },
};
