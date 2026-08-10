import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PwaRegistration } from "./pwa-registration";

describe("PwaRegistration", () => {
  it("renders without changing the document in test mode", () => {
    const { container } = render(<PwaRegistration />);
    expect(container).toBeEmptyDOMElement();
  });
});
