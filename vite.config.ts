import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub project Pages serves this repository below /MahjongScore/.
export default defineConfig({
  base: "/MahjongScore/",
  plugins: [react()],
});
