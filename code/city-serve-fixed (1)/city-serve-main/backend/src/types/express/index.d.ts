import { Role } from "../../models";

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                userId?: string;
                role: Role;
            };
        }
    }
}
