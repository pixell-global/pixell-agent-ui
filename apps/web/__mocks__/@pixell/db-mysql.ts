// Mock database module
export const db = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  $returningId: jest.fn(),
}

export const getDb = jest.fn().mockResolvedValue(db)

export default db
