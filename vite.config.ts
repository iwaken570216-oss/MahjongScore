import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const url = env.VITE_SUPABASE_URL,
    key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (Boolean(url) !== Boolean(key))
    throw new Error(
      "Supabase URLと公開用キーは両方設定してください。未使用の場合は両方空にします。",
    );
  if (key) {
    let role = "";
    try {
      role =
        JSON.parse(
          atob(
            key.split(".")[1]?.replaceAll("-", "+").replaceAll("_", "/") ?? "",
          ),
        ).role ?? "";
    } catch {
      /* Publishable keys are not JWTs. */
    }
    if (key.startsWith("sb_secret_") || role === "service_role")
      throw new Error(
        "service_role/secretキーを公開用のVITE変数に設定しないでください。",
      );
    if (new URL(url).protocol !== "https:")
      throw new Error("Supabase URLにはHTTPSを指定してください。");
  }
  return { base: "/MahjongScore/", plugins: [react()] };
});
