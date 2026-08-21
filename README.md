# Sekkei

技術データ管理システム — desktop-first web app for managing electrical/mechanical
part data, drawings, catalogs and calculation workflows.

This is the **UI/architecture scaffold** phase: navigation, page layouts, shared
components and the service-layer contracts are in place, backed by mock data.
No real DWG/PDF rendering, calculation formulas, database or file storage is
wired up yet — see "What's mocked" below.

## Stack

- Next.js 16 (App Router) + TypeScript + React 19
- Tailwind CSS v4 (dark technical theme, tokens in `src/app/globals.css`)
- No external state/data-fetching library — a small repository-style service
  layer (`src/lib/services`) stands in for a future backend.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000 — it redirects to `/search`.

```bash
npm run lint     # eslint
npx tsc --noEmit # typecheck
npm run build    # production build
```

## Project structure

```
src/
  app/                    routes (one folder per top-level menu item)
  components/
    layout/                AppShell, AppSidebar, GlobalSearch
    common/                 DataTable, FilePreview, FileActions, ExportActions, ...
    calculation/            CalculationForm/Result/PageView (shared by all calc modules)
    import/                  ImportPreview
    settings/                LanguageSwitcher
  lib/
    types/                  domain entities (PartData, PartDrawing, Catalog, ...)
    mock/                    in-memory mock data
    services/                repository interfaces + mock implementations
    i18n/                    ja/vi dictionaries + LanguageProvider
    store/                   PartAssemblyProvider (部品製作 table state)
```

## Swapping mock data for a real backend later

Every page imports a `*Service` singleton from `src/lib/services`, never the
mock data modules directly. Each service implements an interface defined in
`src/lib/services/types.ts` (`PartDataRepository`, `CalculationRepository`,
`ImportRepository`, ...). Replacing the mock implementation with one backed
by a real API/database/file storage should not require any page or component
changes.

## What's mocked in this phase

- All data (parts, drawings, catalogs, manufacturers) is static, in-memory.
- DWG/PDF preview shows a placeholder + file list; no real rendering/conversion.
- 選定 and every 計算 (重量/換気/耐震/母線銅帯/アース電線サイズ) return placeholder
  results — no real formulas.
- Excel/PDF/DWG export buttons simulate a delay and resolve with a fake file name.
- Import analysis fabricates 新規/既存/スキップ/エラー rows instead of parsing files.
- 計算設定 / Excelテンプレート in 設定 accept uploads (stored in memory) but nothing
  consumes them yet.
