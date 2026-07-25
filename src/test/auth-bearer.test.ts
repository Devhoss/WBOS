import { describe, it, expect, beforeAll } from "vitest";
import { getTestInstance } from "better-auth/test";

describe("Bearer Token Auth Integration", () => {
  let auth: Awaited<ReturnType<typeof getTestInstance>>["auth"];
  let customFetchImpl: Awaited<ReturnType<typeof getTestInstance>>["customFetchImpl"];
  let testUser: Awaited<ReturnType<typeof getTestInstance>>["testUser"];

  beforeAll(async () => {
    const instance = await getTestInstance({}, {});
    auth = instance.auth;
    customFetchImpl = instance.customFetchImpl;
    testUser = instance.testUser;
  });

  it("completes sign-in → session → sign-out flow with Bearer tokens", async () => {
    // 1. Sign in via HTTP to capture the set-auth-token response header
    const signInResponse = await customFetchImpl(
      "http://localhost:3000/api/auth/sign-in/email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password,
        }),
      },
    );

    expect(signInResponse.status).toBe(200);

    const bearerToken = signInResponse.headers.get("set-auth-token");
    expect(bearerToken).toBeTruthy();

    // 2. Validate session with the Bearer token via auth.api.getSession
    const session = await auth.api.getSession({
      headers: new Headers({
        Authorization: `Bearer ${bearerToken}`,
      }),
    });

    expect(session).not.toBeNull();
    expect(session!.user.email).toBe(testUser.email);

    // 3. Sign out using the Bearer token
    await auth.api.signOut({
      headers: new Headers({
        Authorization: `Bearer ${bearerToken}`,
      }),
    });

    // 4. Verify the same token can no longer access getSession
    const afterSignOut = await auth.api.getSession({
      headers: new Headers({
        Authorization: `Bearer ${bearerToken}`,
      }),
    });

    expect(afterSignOut).toBeNull();
  });
});
