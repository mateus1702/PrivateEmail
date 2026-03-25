/** Global test setup. Extend with DOM matchers or MSW handlers as needed. */
import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);
