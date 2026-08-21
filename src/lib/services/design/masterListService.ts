import { delay } from "@/lib/utils/async";
import type { MasterListItem } from "@/lib/types/design";
import { masterListRepository } from "./masterListRepository";

export const masterListService = {
  async listKeys(): Promise<string[]> {
    return delay(masterListRepository.listKeys(), 100);
  },
  async listByKey(listKey: string, includeDisabled = false): Promise<MasterListItem[]> {
    return delay(masterListRepository.listByKey(listKey, includeDisabled), 100);
  },
  async add(listKey: string, value: string): Promise<MasterListItem> {
    return delay(masterListRepository.add(listKey, value), 150);
  },
  async update(id: string, value: string): Promise<void> {
    masterListRepository.update(id, value);
    return delay(undefined, 100);
  },
  async remove(id: string): Promise<void> {
    masterListRepository.remove(id);
    return delay(undefined, 100);
  },
  async toggleEnabled(id: string): Promise<void> {
    masterListRepository.toggleEnabled(id);
    return delay(undefined, 100);
  },
  async move(id: string, direction: "up" | "down"): Promise<void> {
    masterListRepository.move(id, direction);
    return delay(undefined, 100);
  },
};
