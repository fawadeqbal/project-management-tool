import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'hearth:isPublic';
export const NO_WORKSPACE = 'hearth:noWorkspace';

/** Route needs no authentication (register, login, health). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Route needs an authenticated user but no workspace context (e.g. listing your workspaces). */
export const NoWorkspace = () => SetMetadata(NO_WORKSPACE, true);
