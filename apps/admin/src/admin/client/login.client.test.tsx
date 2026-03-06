"use client";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminLoginPage } from "./login.client";

const API_ORIGIN = "https://api.example.com";

vi.mock("./http", async () => {
  const actual = await vi.importActual<typeof import("./http")>("./http");
  return {
    ...actual,
    buildAdminApiUrl: vi.fn((path: string) => `${API_ORIGIN}${path}`),
    writeAdminSession: vi.fn(),
  };
});

describe("AdminLoginPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/login");
  });

  it("blocks empty submits without calling the API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    render(<AdminLoginPage />);

    fireEvent.submit(
      screen.getByRole("button", { name: "Sign In" }).closest("form")!,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Enter password first."),
    ).toBeInTheDocument();
  });

  it("shows an error when login fails", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Invalid password." }), {
        status: 401,
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    render(<AdminLoginPage />);

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-password" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid password.")).toBeInTheDocument();
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${API_ORIGIN}/v1/admin/auth/login`,
    );
  });
});
