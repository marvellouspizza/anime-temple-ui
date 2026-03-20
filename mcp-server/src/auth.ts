import fetch from "node-fetch";

export async function getSecondMeUserId(authHeader?: string): Promise<string> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }
  
  const token = authHeader.split(" ")[1];
  
  const res = await fetch("https://api.mindverse.com/gate/lab/api/secondme/user/info", {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!res.ok) {
    throw new Error("Invalid token or unauthorized");
  }
  
  const data = await res.json() as any;
  if (data.code !== 0) throw new Error(data.message || "Failed to fetch SecondMe user");
  
  // API 返回的 userId 就是 SecondMe 的唯一稳定标识
  const userId = data.data?.userId;
  if (!userId) throw new Error("User ID not found in token");
  
  return String(userId);
}
