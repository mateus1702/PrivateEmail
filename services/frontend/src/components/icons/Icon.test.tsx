/**
 * Icon registry: presence, sizing, and accessibility contracts.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Icon } from "./Icon";

describe("Icon", () => {
  it("renders a success glyph", () => {
    const { container } = render(<Icon name="success" decorative />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("exposes aria-label on the wrapper when not decorative", () => {
    render(
      <Icon
        name="error"
        decorative={false}
        aria-label="Configuration failed"
        data-testid="icon-error"
      />
    );
    const el = screen.getByTestId("icon-error");
    expect(el).toHaveAttribute("role", "img");
    expect(el).toHaveAttribute("aria-label", "Configuration failed");
  });

  it("marks decorative icons as aria-hidden", () => {
    render(<Icon name="close" decorative data-testid="icon-close" />);
    const el = screen.getByTestId("icon-close");
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).not.toHaveAttribute("role");
  });
});
