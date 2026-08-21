import { delay } from "@/lib/utils/async";
import type {
  CasePanel,
  DesignCase,
  DesignCaseSearchQuery,
  DesignCaseWithPanels,
  PanelNo,
} from "@/lib/types/design";
import { formatDrawingNumber, getNextSequenceForYear } from "@/lib/utils/designNumbering";
import { loadFromStorage, saveToStorage } from "@/lib/utils/localStore";

const CASES_KEY = "sekkei.design.cases";
const PANELS_KEY = "sekkei.design.panels";

function emptyPanel(caseId: string, panelNo: PanelNo): CasePanel {
  return {
    id: `panel-${caseId}-${panelNo}`,
    caseId,
    panelNo,
    panelName: "",
    panelStructure: "",
    faceCount: null,
    designDueDate: null,
    designEstimatedHours: null,
    designActualHours: null,
    productionEstimatedHours: null,
    productionActualHours: null,
    electricalMethod: "",
    ratedVoltage: "",
    ratedCurrent: "",
    ratedBreakingCapacity: "",
    frequency: "",
    controlVoltage: "",
    protectionRating: "",
  };
}

const SEED_CASES: DesignCase[] = [
  {
    id: "case-seed-1",
    projectId: "proj-sample",
    year: 2026,
    sequenceNo: 1,
    drawingNumber: "26-001",
    requestType: "新規",
    managementNumber: "A260101",
    constructionNumber: "R123456",
    orderer: "サンプル電機株式会社",
    customerContact: "山田",
    projectName: "本社ビル電気設備改修",
    specs: {},
    designRemarks: "",
    createdAt: "2026-01-06",
    updatedAt: "2026-01-06",
  },
  {
    id: "case-seed-2",
    projectId: "proj-sample",
    year: 2026,
    sequenceNo: 2,
    drawingNumber: "26-002",
    requestType: "新規",
    managementNumber: "A260102",
    constructionNumber: "V1123456",
    orderer: "サンプル電機株式会社",
    customerContact: "鈴木",
    projectName: "工場ライン増設",
    specs: {},
    designRemarks: "",
    createdAt: "2026-02-10",
    updatedAt: "2026-02-10",
  },
  {
    id: "case-seed-3",
    projectId: "proj-sample",
    year: 2026,
    sequenceNo: 3,
    drawingNumber: "26-003",
    requestType: "変更",
    managementNumber: "A260103",
    constructionNumber: "R223344",
    orderer: "サンプル電機株式会社",
    customerContact: "山田",
    projectName: "倉庫照明更新",
    specs: {},
    designRemarks: "",
    createdAt: "2026-03-02",
    updatedAt: "2026-03-02",
  },
];

const SEED_PANELS: CasePanel[] = [
  {
    ...emptyPanel("case-seed-1", 1),
    panelName: "動力盤",
    panelStructure: "自立盤",
    faceCount: 1,
    designEstimatedHours: 8,
    designActualHours: 6,
  },
  {
    ...emptyPanel("case-seed-2", 1),
    panelName: "制御盤",
    panelStructure: "壁掛盤",
    faceCount: 1,
    designEstimatedHours: 5,
    designActualHours: null,
  },
  {
    ...emptyPanel("case-seed-3", 1),
    panelName: "照明盤",
    panelStructure: "壁掛盤",
    faceCount: 1,
    designEstimatedHours: 3,
    designActualHours: 3,
  },
];

function loadCases(): DesignCase[] {
  return loadFromStorage(CASES_KEY, SEED_CASES);
}
function saveCases(cases: DesignCase[]) {
  saveToStorage(CASES_KEY, cases);
}
function loadPanels(): CasePanel[] {
  return loadFromStorage(PANELS_KEY, SEED_PANELS);
}
function savePanelsAll(panels: CasePanel[]) {
  saveToStorage(PANELS_KEY, panels);
}

function panelsForCase(caseId: string): CasePanel[] {
  return loadPanels()
    .filter((p) => p.caseId === caseId)
    .sort((a, b) => a.panelNo - b.panelNo);
}

export interface CreateCaseInput {
  projectId: string;
  year: number;
  requestType: string;
  managementNumber: string;
  constructionNumber: string;
  orderer: string;
  customerContact: string;
  projectName: string;
}

export const designCaseService = {
  async listByProject(projectId: string): Promise<DesignCaseWithPanels[]> {
    const cases = loadCases()
      .filter((c) => c.projectId === projectId)
      .sort((a, b) => b.drawingNumber.localeCompare(a.drawingNumber));
    const result = cases.map((c) => ({ case: c, panels: panelsForCase(c.id) }));
    return delay(result, 200);
  },

  async getDetail(caseId: string): Promise<DesignCaseWithPanels | null> {
    const found = loadCases().find((c) => c.id === caseId);
    if (!found) return delay(null, 100);
    return delay({ case: found, panels: panelsForCase(caseId) }, 150);
  },

  /** Preview only — does not reserve the number. The real number is assigned atomically in `create`. */
  async previewNextDrawingNumber(year: number): Promise<string> {
    const seq = getNextSequenceForYear(loadCases(), year);
    return delay(formatDrawingNumber(year, seq), 100);
  },

  async create(input: CreateCaseInput): Promise<DesignCase> {
    const cases = loadCases();
    // Computed and persisted in the same step so there is no window where a
    // second create() could read the same "next" number — the best this
    // mock (single browser tab) can offer. A real backend needs a DB unique
    // constraint on (year, sequence_no) + a transaction for true safety
    // across concurrent users.
    const sequenceNo = getNextSequenceForYear(cases, input.year);
    const now = new Date().toISOString().slice(0, 10);
    const created: DesignCase = {
      id: `case-${Date.now()}`,
      projectId: input.projectId,
      year: input.year,
      sequenceNo,
      drawingNumber: formatDrawingNumber(input.year, sequenceNo),
      requestType: input.requestType,
      managementNumber: input.managementNumber,
      constructionNumber: input.constructionNumber,
      orderer: input.orderer,
      customerContact: input.customerContact,
      projectName: input.projectName,
      specs: {},
      designRemarks: "",
      createdAt: now,
      updatedAt: now,
    };
    cases.push(created);
    saveCases(cases);
    return delay(created, 250);
  },

  async update(caseId: string, patch: Partial<DesignCase>): Promise<DesignCase> {
    const cases = loadCases();
    const index = cases.findIndex((c) => c.id === caseId);
    if (index === -1) throw new Error(`Design case not found: ${caseId}`);
    const updated: DesignCase = {
      ...cases[index],
      ...patch,
      id: cases[index].id,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    cases[index] = updated;
    saveCases(cases);
    return delay(updated, 200);
  },

  /** Replaces the full panel set for a case (盤①～⑦ are edited together as one form). */
  async savePanels(caseId: string, panels: CasePanel[]): Promise<CasePanel[]> {
    const all = loadPanels().filter((p) => p.caseId !== caseId);
    const next = [...all, ...panels];
    savePanelsAll(next);
    return delay(panels, 200);
  },

  async search(query: DesignCaseSearchQuery): Promise<DesignCaseWithPanels[]> {
    const cases = loadCases();
    const panels = loadPanels();

    const matches = cases.filter((c) => {
      if (query.projectId && c.projectId !== query.projectId) return false;
      if (query.year && c.year !== query.year) return false;
      if (query.drawingNumber && !c.drawingNumber.includes(query.drawingNumber.trim())) return false;
      if (
        query.managementNumber &&
        !c.managementNumber.toLowerCase().includes(query.managementNumber.trim().toLowerCase())
      )
        return false;
      if (
        query.constructionNumber &&
        !c.constructionNumber.toLowerCase().includes(query.constructionNumber.trim().toLowerCase())
      )
        return false;
      if (query.orderer && !c.orderer.toLowerCase().includes(query.orderer.trim().toLowerCase()))
        return false;
      if (
        query.customerContact &&
        !c.customerContact.toLowerCase().includes(query.customerContact.trim().toLowerCase())
      )
        return false;
      if (
        query.projectName &&
        !c.projectName.toLowerCase().includes(query.projectName.trim().toLowerCase())
      )
        return false;
      if (query.panelName) {
        const casePanels = panels.filter((p) => p.caseId === c.id);
        const hasMatch = casePanels.some((p) =>
          p.panelName.toLowerCase().includes(query.panelName!.trim().toLowerCase()),
        );
        if (!hasMatch) return false;
      }
      return true;
    });

    const result = matches.map((c) => ({ case: c, panels: panelsForCase(c.id) }));
    return delay(result, 250);
  },
};
