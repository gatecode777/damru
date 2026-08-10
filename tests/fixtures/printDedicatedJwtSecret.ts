import { getJwtSecret } from "../../lib/env";

process.env.JWT_SECRET = "dedicated-jwt-secret";
process.env.AUTH_SECRET = "auth-secret-fallback";
process.stdout.write(getJwtSecret());
