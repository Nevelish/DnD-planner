-- AlterEnum
-- BEFORE 'NO' keeps Postgres' enum order matching the schema (Yes, Maybe, No).
ALTER TYPE "RsvpStatus" ADD VALUE 'MAYBE' BEFORE 'NO';
