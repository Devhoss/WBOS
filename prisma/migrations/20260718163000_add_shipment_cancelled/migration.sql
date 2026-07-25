-- Add CANCELLED to ShipmentStatus enum for cancellation cascade
ALTER TYPE "ShipmentStatus" ADD VALUE 'CANCELLED';
