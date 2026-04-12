// Re-export the existing Prisma client instance to avoid duplicate connections
import prisma from '../src/config/database.js';
export default prisma;
