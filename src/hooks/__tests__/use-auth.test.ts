import { renderHook, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";
import { useAuth } from "@/hooks/use-auth";

const mockSignIn = vi.mocked(signInAction);
const mockSignUp = vi.mocked(signUpAction);
const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
const mockClearAnonWork = vi.mocked(clearAnonWork);
const mockGetProjects = vi.mocked(getProjects);
const mockCreateProject = vi.mocked(createProject);

const ANON_WORK = {
  messages: [{ role: "user", content: "hello" }],
  fileSystemData: { "/": { type: "directory" } },
};

const PROJECTS = [
  { id: "proj-1", name: "First", createdAt: new Date(), updatedAt: new Date() },
  { id: "proj-2", name: "Second", createdAt: new Date(), updatedAt: new Date() },
];

const CREATED_PROJECT = {
  id: "new-proj",
  name: "New Design",
  userId: "user-1",
  messages: "[]",
  data: "{}",
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue(CREATED_PROJECT);
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("initial state", () => {
  it("exposes signIn, signUp, and isLoading=false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// signIn — happy paths
// ---------------------------------------------------------------------------

describe("signIn", () => {
  describe("when sign-in succeeds with anonymous work", () => {
    it("migrates anon work into a new project and navigates to it", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(ANON_WORK);

      const { result } = renderHook(() => useAuth());
      await act(() => result.current.signIn("user@example.com", "password123"));

      expect(mockCreateProject).toHaveBeenCalledWith({
        name: expect.stringContaining("Design from"),
        messages: ANON_WORK.messages,
        data: ANON_WORK.fileSystemData,
      });
      expect(mockClearAnonWork).toHaveBeenCalledOnce();
      expect(mockPush).toHaveBeenCalledWith(`/${CREATED_PROJECT.id}`);
      expect(mockGetProjects).not.toHaveBeenCalled();
    });
  });

  describe("when sign-in succeeds with no anon work but existing projects", () => {
    it("navigates to the most recent project", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue(PROJECTS);

      const { result } = renderHook(() => useAuth());
      await act(() => result.current.signIn("user@example.com", "password123"));

      expect(mockCreateProject).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith(`/${PROJECTS[0].id}`);
    });
  });

  describe("when sign-in succeeds with no anon work and no projects", () => {
    it("creates a blank project and navigates to it", async () => {
      mockSignIn.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      await act(() => result.current.signIn("user@example.com", "password123"));

      expect(mockCreateProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/^New Design #\d+$/),
        messages: [],
        data: {},
      });
      expect(mockPush).toHaveBeenCalledWith(`/${CREATED_PROJECT.id}`);
    });
  });

  describe("when sign-in fails", () => {
    it("returns the failure result without navigating", async () => {
      mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());
      let returnValue: Awaited<ReturnType<typeof result.current.signIn>>;
      await act(async () => {
        returnValue = await result.current.signIn("user@example.com", "wrong");
      });

      expect(returnValue!).toEqual({ success: false, error: "Invalid credentials" });
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockCreateProject).not.toHaveBeenCalled();
    });
  });

  describe("isLoading lifecycle", () => {
    it("is true while the action is in-flight and false after it resolves", async () => {
      let resolveSignIn!: (v: { success: boolean }) => void;
      const pending = new Promise<{ success: boolean }>((res) => {
        resolveSignIn = res;
      });
      mockSignIn.mockReturnValue(pending);

      const { result } = renderHook(() => useAuth());

      // Kick off without awaiting so we can inspect mid-flight state
      act(() => { result.current.signIn("user@example.com", "password123"); });
      expect(result.current.isLoading).toBe(true);

      // Resolve and flush
      await act(async () => resolveSignIn({ success: false }));
      expect(result.current.isLoading).toBe(false);
    });

    it("resets isLoading to false even when the action throws", async () => {
      mockSignIn.mockRejectedValue(new Error("network error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        try {
          await result.current.signIn("user@example.com", "password123");
        } catch {
          // expected
        }
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// signUp — happy paths
// ---------------------------------------------------------------------------

describe("signUp", () => {
  describe("when sign-up succeeds with anonymous work", () => {
    it("migrates anon work into a new project and navigates to it", async () => {
      mockSignUp.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(ANON_WORK);

      const { result } = renderHook(() => useAuth());
      await act(() => result.current.signUp("new@example.com", "password123"));

      expect(mockCreateProject).toHaveBeenCalledWith({
        name: expect.stringContaining("Design from"),
        messages: ANON_WORK.messages,
        data: ANON_WORK.fileSystemData,
      });
      expect(mockClearAnonWork).toHaveBeenCalledOnce();
      expect(mockPush).toHaveBeenCalledWith(`/${CREATED_PROJECT.id}`);
    });
  });

  describe("when sign-up succeeds with no anon work but existing projects", () => {
    it("navigates to the most recent project", async () => {
      mockSignUp.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue(PROJECTS);

      const { result } = renderHook(() => useAuth());
      await act(() => result.current.signUp("new@example.com", "password123"));

      expect(mockCreateProject).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith(`/${PROJECTS[0].id}`);
    });
  });

  describe("when sign-up succeeds with no anon work and no projects", () => {
    it("creates a blank project and navigates to it", async () => {
      mockSignUp.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      await act(() => result.current.signUp("new@example.com", "password123"));

      expect(mockCreateProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/^New Design #\d+$/),
        messages: [],
        data: {},
      });
      expect(mockPush).toHaveBeenCalledWith(`/${CREATED_PROJECT.id}`);
    });
  });

  describe("when sign-up fails", () => {
    it("returns the failure result without navigating", async () => {
      mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());
      let returnValue: Awaited<ReturnType<typeof result.current.signUp>>;
      await act(async () => {
        returnValue = await result.current.signUp("existing@example.com", "password123");
      });

      expect(returnValue!).toEqual({ success: false, error: "Email already registered" });
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("isLoading lifecycle", () => {
    it("resets isLoading to false even when the action throws", async () => {
      mockSignUp.mockRejectedValue(new Error("db error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        try {
          await result.current.signUp("new@example.com", "password123");
        } catch {
          // expected
        }
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("ignores anon work when messages array is empty", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
    mockGetProjects.mockResolvedValue(PROJECTS);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("user@example.com", "password123"));

    // Should fall through to getProjects, not migrate empty anon work
    expect(mockGetProjects).toHaveBeenCalled();
    expect(mockClearAnonWork).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(`/${PROJECTS[0].id}`);
  });

  it("navigates to first (most recent) project when multiple exist", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue(PROJECTS);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("user@example.com", "password123"));

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(`/${PROJECTS[0].id}`);
  });

  it("generates a different project name on each call (random suffix)", async () => {
    mockSignIn.mockResolvedValue({ success: true });

    const names: string[] = [];
    mockCreateProject.mockImplementation(async (input) => {
      names.push(input.name);
      return CREATED_PROJECT;
    });

    const { result } = renderHook(() => useAuth());
    // Two separate hook instances to get independent calls
    const { result: result2 } = renderHook(() => useAuth());

    await act(() => result.current.signIn("a@example.com", "password123"));
    await act(() => result2.current.signIn("b@example.com", "password123"));

    // Both match the pattern; they may or may not be equal (random), but both valid
    names.forEach((name) => expect(name).toMatch(/^New Design #\d+$/));
  });

  it("does not navigate when signIn returns success:false even if anon work exists", async () => {
    mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });
    mockGetAnonWorkData.mockReturnValue(ANON_WORK);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("user@example.com", "wrong"));

    expect(mockCreateProject).not.toHaveBeenCalled();
    expect(mockClearAnonWork).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
