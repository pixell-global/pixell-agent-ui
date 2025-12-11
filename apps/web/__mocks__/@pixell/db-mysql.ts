// Mock database module with proper method chaining
// Create individual mock functions that can be accessed in tests
export const mockLimit = jest.fn()
export const mockWhere = jest.fn()
export const mockSet = jest.fn()
export const mockValues = jest.fn()
export const mockReturningId = jest.fn()
export const mockFrom = jest.fn()
export const mockSelect = jest.fn()
export const mockInsert = jest.fn()
export const mockUpdate = jest.fn()
export const mockDelete = jest.fn()

const createDb = () => {
  const chain: any = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    from: mockFrom,
    where: mockWhere,
    set: mockSet,
    values: mockValues,
    limit: mockLimit,
    $returningId: mockReturningId,
  }

  // Make all methods return the chain for chaining
  mockSelect.mockReturnValue(chain)
  mockInsert.mockReturnValue(chain)
  mockUpdate.mockReturnValue(chain)
  mockDelete.mockReturnValue(chain)
  mockFrom.mockReturnValue(chain)
  mockWhere.mockReturnValue(chain)
  mockSet.mockReturnValue(chain)
  mockValues.mockReturnValue(chain)

  return chain
}

export const db = createDb()

export const getDb = jest.fn().mockResolvedValue(db)

export default db
