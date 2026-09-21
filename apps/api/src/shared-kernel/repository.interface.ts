export interface Repository<T, Id> {
  findById(id: Id): Promise<T | null>;
  save(entity: T): Promise<void>;
  delete(id: Id): Promise<void>;
}
