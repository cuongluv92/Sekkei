import { describe, it, expect } from "vitest";
import { createRef } from "react";
import { render, waitFor } from "@testing-library/react";
import { ScrollTopSync } from "./ScrollTopSync";

describe("ScrollTopSync", () => {
  it("renders the top bar as a sibling placed directly before the wrap, hidden by default", () => {
    const { container } = render(
      <ScrollTopSync className="data-table-wrap">
        <table>
          <tbody>
            <tr>
              <td>x</td>
            </tr>
          </tbody>
        </table>
      </ScrollTopSync>,
    );

    const wrap = container.querySelector(".data-table-wrap") as HTMLElement;
    const topBar = container.querySelector(".table-top-scroll") as HTMLElement;
    expect(topBar).toBeTruthy();
    // 直前(above)の兄弟として並ぶ — wrap自体のDOM上の親は変わらない。
    expect(topBar.nextElementSibling).toBe(wrap);
    // jsdomではscrollWidth/clientWidthが常に0(=はみ出していない)なので、
    // SSR時と同じ非表示のまま — 実ブラウザでの表示/非表示切り替えは
    // Playwrightでの手動検証で確認済み。
    expect(topBar.style.display).toBe("none");
  });

  it("syncs scroll position bidirectionally between the top bar and the wrap", async () => {
    const { container } = render(
      <ScrollTopSync className="data-table-wrap">
        <table>
          <tbody>
            <tr>
              <td>x</td>
            </tr>
          </tbody>
        </table>
      </ScrollTopSync>,
    );
    const wrap = container.querySelector(".data-table-wrap") as HTMLElement;
    const topBar = container.querySelector(".table-top-scroll") as HTMLElement;

    topBar.scrollLeft = 80;
    topBar.dispatchEvent(new Event("scroll"));
    await waitFor(() => expect(wrap.scrollLeft).toBe(80));

    wrap.scrollLeft = 30;
    wrap.dispatchEvent(new Event("scroll"));
    await waitFor(() => expect(topBar.scrollLeft).toBe(30));
  });

  it("forwards a ref to the actual scrollable wrap element", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <ScrollTopSync ref={ref} className="data-table-wrap">
        <div>content</div>
      </ScrollTopSync>,
    );
    expect(ref.current).not.toBeNull();
    expect(ref.current?.className).toBe("data-table-wrap");
  });
});
