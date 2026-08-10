import { getJwtSecret } from "../../lib/env";

delete process.env.JWT_SECRET;
process.env.AUTH_SECRET = "auth-secret-fallback";
process.stdout.write(getJwtSecret());
