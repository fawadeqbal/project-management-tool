/**
 * @hearth/domain — the framework-free core (hexagonal architecture's inner ring).
 * Nothing here imports NestJS, Prisma, React or HTTP concerns; it is shared by the API
 * (aggregates, policies, domain services) and the web app (filters, grouping, date rules).
 */
export * from './shared';
export * from './task';
export * from './access';
export * from './project';
export * from './planning';
export * from './workload';
export * from './sprint';
export * from './inbox';
export * from './reporting';
export * from './billing';
export * from './search';
export * from './onboarding';
export * from './ai';
