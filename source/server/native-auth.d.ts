export type OwnerEnvironment = Pick<Env, 'DB' | 'EMAIL' | 'MARKER_ORIGIN' | 'MARKER_OWNER_EMAIL' | 'MARKER_SENDER_EMAIL' | 'MARKER_AUTH_SECRET'> & { MARKER_GOOGLE_CLIENT_ID?: string; MARKER_GOOGLE_CLIENT_SECRET?: string; MARKER_GITHUB_CLIENT_ID?:string;MARKER_GITHUB_CLIENT_SECRET?:string };
export type OwnerPrincipal = { tenantId: string; userId: string; email: string; authenticatedAt: number; method: 'email' | 'google' | 'github' };
export type OwnerAuthDescriptor = { authFlow: 'code'; methods: { email: { configured: boolean }; google: { configured: boolean; bound: boolean; canLink: boolean; linkRequiresEmailVerification: boolean };github:{configured:boolean;bound:boolean;canLink:boolean;linkRequiresEmailVerification:boolean} }; principal?: OwnerPrincipal };
export function ownerSession(request: Request, env: OwnerEnvironment): Promise<OwnerPrincipal | null>;
export function describeOwnerAuth(request: Request, env: OwnerEnvironment): Promise<OwnerAuthDescriptor>;
export function authorizedOwner(request: Request, env: OwnerEnvironment): Promise<boolean>;
export function handleOwnerAuth(request: Request, env: OwnerEnvironment, ctx: Pick<ExecutionContext, 'waitUntil'>): Promise<Response>;
export function purgeOwnerAuth(env: OwnerEnvironment): Promise<unknown>;
