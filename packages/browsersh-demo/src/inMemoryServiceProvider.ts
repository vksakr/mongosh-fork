import type {
  AggregateOptions,
  CountDocumentsOptions,
  CountOptions,
  DbOptions,
  DeleteOptions,
  DeleteResult,
  Document,
  EstimatedDocumentCountOptions,
  FindOneAndDeleteOptions,
  FindOneAndReplaceOptions,
  FindOneAndUpdateOptions,
  FindOptions,
  InsertManyOptions,
  InsertManyResult,
  InsertOneOptions,
  InsertOneResult,
  ListDatabasesOptions,
  ReadConcern,
  ReadPreference,
  ReplaceOptions,
  RunCommandOptions,
  UpdateOptions,
  UpdateResult,
  WriteConcern,
} from '@mongosh/service-provider-core';
import type { ServiceProviderFindCursor } from '@mongosh/service-provider-core';
import type { ConnectionInfo } from '@mongosh/service-provider-core';
import * as bson from 'bson';

type StoredDocument = Record<string, any>;

type CollectionStore = Map<string, StoredDocument[]>;

type DatabaseStore = Map<string, CollectionStore>;

const cloneDoc = (doc: StoredDocument): StoredDocument => ({ ...doc });

const matchesFilter = (doc: StoredDocument, filter: Document = {}): boolean => {
  return Object.entries(filter).every(([key, value]) => doc[key] === value);
};

export class InMemoryCursor implements ServiceProviderFindCursor<StoredDocument> {
  private docs: StoredDocument[];
  private index = 0;
  private limitCount: number | null = null;
  private skipCount = 0;
  private isClosed = false;

  constructor(docs: StoredDocument[]) {
    this.docs = docs;
  }

  private getVisibleDocs(): StoredDocument[] {
    const sliced = this.docs.slice(this.skipCount);
    return this.limitCount === null ? sliced : sliced.slice(0, this.limitCount);
  }

  private advance(): StoredDocument | null {
    const visible = this.getVisibleDocs();
    if (this.index >= visible.length) {
      this.isClosed = true;
      return null;
    }
    return visible[this.index++];
  }

  async close(): Promise<void> {
    this.isClosed = true;
  }

  async hasNext(): Promise<boolean> {
    return this.index < this.getVisibleDocs().length;
  }

  async next(): Promise<StoredDocument | null> {
    return this.advance();
  }

  async tryNext(): Promise<StoredDocument | null> {
    return this.advance();
  }

  get closed(): boolean {
    return this.isClosed;
  }

  [Symbol.asyncIterator](): AsyncGenerator<StoredDocument, void, void> {
    const iterator = async function* (cursor: InMemoryCursor) {
      let next;
      while ((next = await cursor.tryNext())) {
        yield next;
      }
    };

    return iterator(this);
  }

  batchSize(): void {
    /* no-op */
  }

  maxTimeMS(): void {
    /* no-op */
  }

  bufferedCount(): number {
    return this.getVisibleDocs().length - this.index;
  }

  readBufferedDocuments(
    number = this.getVisibleDocs().length
  ): StoredDocument[] {
    const visible = this.getVisibleDocs();
    const slice = visible.slice(this.index, this.index + number);
    this.index += slice.length;
    return slice;
  }

  async toArray(): Promise<StoredDocument[]> {
    return this.getVisibleDocs();
  }

  project(): void {
    /* no-op */
  }

  skip(count: number): void {
    this.skipCount = count;
  }

  sort(sortDoc: Document): void {
    const entries = Object.entries(sortDoc);
    if (entries.length === 0) {
      return;
    }
    const [field, direction] = entries[0];
    const dir = direction === -1 ? -1 : 1;
    this.docs.sort((a, b) => {
      if (a[field] === b[field]) {
        return 0;
      }
      return a[field] > b[field] ? dir : -dir;
    });
  }

  explain(): Promise<Document> {
    return Promise.resolve({ ok: 1, note: 'In-memory cursor' });
  }

  addCursorFlag(): void {
    /* no-op */
  }

  withReadPreference(): this {
    return this;
  }

  withReadConcern(): this {
    return this;
  }

  allowDiskUse(): void {
    /* no-op */
  }

  collation(): void {
    /* no-op */
  }

  comment(): void {
    /* no-op */
  }

  maxAwaitTimeMS(): void {
    /* no-op */
  }

  count(): Promise<number> {
    return Promise.resolve(this.getVisibleDocs().length);
  }

  hint(): void {
    /* no-op */
  }

  max(): void {
    /* no-op */
  }

  min(): void {
    /* no-op */
  }

  limit(value: number): void {
    this.limitCount = value;
  }

  returnKey(): void {
    /* no-op */
  }

  showRecordId(): void {
    /* no-op */
  }
}

export class InMemoryServiceProvider {
  platform = 'Browser' as const;
  initialDb = 'test';
  bsonLibrary = bson as unknown as typeof bson;
  private databases: DatabaseStore = new Map([
    ['test', new Map([['items', []]])],
  ]);

  private ensureCollection(database: string, collection: string): StoredDocument[] {
    if (!this.databases.has(database)) {
      this.databases.set(database, new Map());
    }
    const dbCollections = this.databases.get(database) as CollectionStore;
    if (!dbCollections.has(collection)) {
      dbCollections.set(collection, []);
    }
    return dbCollections.get(collection) as StoredDocument[];
  }

  private filterDocuments(
    database: string,
    collection: string,
    filter: Document = {}
  ): StoredDocument[] {
    const docs = this.ensureCollection(database, collection);
    return docs.filter((doc) => matchesFilter(doc, filter));
  }

  async buildInfo(): Promise<Document> {
    return { version: '0.0.0-browser', ok: 1 };
  }

  async getConnectionInfo(): Promise<ConnectionInfo> {
    return {
      buildInfo: await this.buildInfo(),
      extraInfo: {
        uri: 'inmemory://browser-repl',
      },
    };
  }

  getTopologyDescription(): { type: string } {
    return { type: 'Single' };
  }

  async listDatabases(
    _database: string,
    _options?: ListDatabasesOptions
  ): Promise<Document> {
    const databases = Array.from(this.databases.keys()).map((name) => ({
      name,
      sizeOnDisk: 0,
      empty: false,
    }));

    return {
      databases,
      totalSize: 0,
      ok: 1,
    };
  }

  async listCollections(
    database: string,
    _filter?: Document,
    _options?: Document,
    _dbOptions?: DbOptions
  ): Promise<Array<{ name: string }>> {
    const collections = this.databases.get(database);
    if (!collections) {
      return [];
    }
    return Array.from(collections.keys()).map((name) => ({ name }));
  }

  async createCollection(
    database: string,
    collection: string
  ): Promise<{ ok: number }> {
    this.ensureCollection(database, collection);
    return { ok: 1 };
  }

  async insertOne(
    database: string,
    collection: string,
    doc: Document,
    _options?: InsertOneOptions,
    _dbOptions?: DbOptions
  ): Promise<InsertOneResult> {
    const docs = this.ensureCollection(database, collection);
    const record = cloneDoc(doc as StoredDocument);
    if (!record._id) {
      record._id = new bson.ObjectId();
    }
    docs.push(record);
    return { acknowledged: true, insertedId: record._id } as InsertOneResult;
  }

  async insertMany(
    database: string,
    collection: string,
    docs: Document[],
    _options?: InsertManyOptions,
    _dbOptions?: DbOptions
  ): Promise<InsertManyResult> {
    const results: Record<number, any> = {};
    const stored = this.ensureCollection(database, collection);
    docs.forEach((doc, index) => {
      const record = cloneDoc(doc as StoredDocument);
      if (!record._id) {
        record._id = new bson.ObjectId();
      }
      stored.push(record);
      results[index] = record._id;
    });
    return {
      acknowledged: true,
      insertedCount: docs.length,
      insertedIds: results,
    } as InsertManyResult;
  }

  async find(
    database: string,
    collection: string,
    filter?: Document,
    _options?: FindOptions,
    _dbOptions?: DbOptions
  ): Promise<ServiceProviderFindCursor<StoredDocument>> {
    const docs = this.filterDocuments(database, collection, filter);
    return new InMemoryCursor(docs.map((doc) => cloneDoc(doc)));
  }

  async count(
    database: string,
    collection: string,
    filter?: Document,
    _options?: CountOptions,
    _dbOptions?: DbOptions
  ): Promise<number> {
    return this.filterDocuments(database, collection, filter).length;
  }

  async countDocuments(
    database: string,
    collection: string,
    filter?: Document,
    _options?: CountDocumentsOptions,
    _dbOptions?: DbOptions
  ): Promise<number> {
    return this.filterDocuments(database, collection, filter).length;
  }

  async estimatedDocumentCount(
    database: string,
    collection: string,
    _options?: EstimatedDocumentCountOptions,
    _dbOptions?: DbOptions
  ): Promise<number> {
    return this.ensureCollection(database, collection).length;
  }

  async deleteOne(
    database: string,
    collection: string,
    filter: Document,
    _options: DeleteOptions,
    _dbOptions?: DbOptions
  ): Promise<DeleteResult> {
    const docs = this.ensureCollection(database, collection);
    const index = docs.findIndex((doc) => matchesFilter(doc, filter));
    if (index === -1) {
      return { acknowledged: true, deletedCount: 0 } as DeleteResult;
    }
    docs.splice(index, 1);
    return { acknowledged: true, deletedCount: 1 } as DeleteResult;
  }

  async deleteMany(
    database: string,
    collection: string,
    filter: Document,
    _options: DeleteOptions,
    _dbOptions?: DbOptions
  ): Promise<DeleteResult> {
    const docs = this.ensureCollection(database, collection);
    const remaining = docs.filter((doc) => !matchesFilter(doc, filter));
    const deletedCount = docs.length - remaining.length;
    const dbCollections = this.databases.get(database) as CollectionStore;
    dbCollections.set(collection, remaining);
    return { acknowledged: true, deletedCount } as DeleteResult;
  }

  async updateOne(
    database: string,
    collection: string,
    filter: Document,
    update: Document,
    _options?: UpdateOptions,
    _dbOptions?: DbOptions
  ): Promise<UpdateResult> {
    const docs = this.ensureCollection(database, collection);
    const doc = docs.find((candidate) => matchesFilter(candidate, filter));
    if (!doc) {
      return {
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0,
      } as UpdateResult;
    }
    if ('$set' in update) {
      Object.assign(doc, update.$set as Document);
    } else {
      Object.assign(doc, update);
    }
    return {
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1,
    } as UpdateResult;
  }

  async updateMany(
    database: string,
    collection: string,
    filter: Document,
    update: Document,
    _options?: UpdateOptions,
    _dbOptions?: DbOptions
  ): Promise<UpdateResult> {
    const docs = this.ensureCollection(database, collection);
    let matchedCount = 0;
    let modifiedCount = 0;
    docs.forEach((doc) => {
      if (!matchesFilter(doc, filter)) {
        return;
      }
      matchedCount += 1;
      if ('$set' in update) {
        Object.assign(doc, update.$set as Document);
      } else {
        Object.assign(doc, update);
      }
      modifiedCount += 1;
    });
    return {
      acknowledged: true,
      matchedCount,
      modifiedCount,
    } as UpdateResult;
  }

  async findOneAndDelete(
    database: string,
    collection: string,
    filter: Document,
    _options: FindOneAndDeleteOptions,
    _dbOptions?: DbOptions
  ): Promise<Document | null> {
    const docs = this.ensureCollection(database, collection);
    const index = docs.findIndex((doc) => matchesFilter(doc, filter));
    if (index === -1) {
      return null;
    }
    const [removed] = docs.splice(index, 1);
    return cloneDoc(removed);
  }

  async findOneAndUpdate(
    database: string,
    collection: string,
    filter: Document,
    update: Document,
    _options: FindOneAndUpdateOptions,
    _dbOptions?: DbOptions
  ): Promise<Document | null> {
    const docs = this.ensureCollection(database, collection);
    const doc = docs.find((candidate) => matchesFilter(candidate, filter));
    if (!doc) {
      return null;
    }
    if ('$set' in update) {
      Object.assign(doc, update.$set as Document);
    } else {
      Object.assign(doc, update);
    }
    return cloneDoc(doc);
  }

  async findOneAndReplace(
    database: string,
    collection: string,
    filter: Document,
    replacement: Document,
    _options: FindOneAndReplaceOptions,
    _dbOptions?: DbOptions
  ): Promise<Document | null> {
    const docs = this.ensureCollection(database, collection);
    const index = docs.findIndex((doc) => matchesFilter(doc, filter));
    if (index === -1) {
      return null;
    }
    const updated = cloneDoc(replacement as StoredDocument);
    docs[index] = updated;
    return cloneDoc(updated);
  }

  async replaceOne(
    database: string,
    collection: string,
    filter: Document,
    replacement: Document,
    _options?: ReplaceOptions,
    _dbOptions?: DbOptions
  ): Promise<UpdateResult> {
    const docs = this.ensureCollection(database, collection);
    const index = docs.findIndex((doc) => matchesFilter(doc, filter));
    if (index === -1) {
      return {
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0,
      } as UpdateResult;
    }
    docs[index] = cloneDoc(replacement as StoredDocument);
    return {
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1,
    } as UpdateResult;
  }

  async aggregate(
    database: string,
    collection: string,
    pipeline: Document[] = [],
    _options?: AggregateOptions,
    _dbOptions?: DbOptions
  ): Promise<ServiceProviderFindCursor<StoredDocument>> {
    const docs = this.ensureCollection(database, collection);
    const firstMatch = pipeline.find((stage) => stage.$match);
    const filtered = firstMatch
      ? docs.filter((doc) => matchesFilter(doc, firstMatch.$match))
      : docs;
    return new InMemoryCursor(filtered.map((doc) => cloneDoc(doc)));
  }

  async aggregateDb(
    database: string,
    pipeline: Document[] = [],
    options?: AggregateOptions,
    dbOptions?: DbOptions
  ): Promise<ServiceProviderFindCursor<StoredDocument>> {
    return this.aggregate(database, 'items', pipeline, options, dbOptions);
  }

  async distinct(
    database: string,
    collection: string,
    field: string,
    filter?: Document
  ): Promise<Document> {
    const docs = this.filterDocuments(database, collection, filter);
    const values = Array.from(new Set(docs.map((doc) => doc[field])));
    return values as unknown as Document;
  }

  async runCommand(
    _database: string,
    _spec: Document,
    _options: RunCommandOptions
  ): Promise<Document> {
    return { ok: 1 };
  }

  async runCommandWithCheck(
    database: string,
    spec: Document,
    options: RunCommandOptions
  ): Promise<Document> {
    return this.runCommand(database, spec, options);
  }

  runCursorCommand(
    _database: string,
    _spec: Document,
    _options: Document
  ): ServiceProviderFindCursor<StoredDocument> {
    return new InMemoryCursor([]);
  }

  async close(): Promise<void> {
    /* no-op */
  }

  async suspend(): Promise<() => Promise<void>> {
    return async () => {
      /* no-op */
    };
  }

  getURI(): string {
    return 'inmemory://browser-repl';
  }

  async getNewConnection(): Promise<InMemoryServiceProvider> {
    return this;
  }

  async authenticate(): Promise<{ ok: number }> {
    return { ok: 1 };
  }

  getReadPreference(): ReadPreference {
    return { mode: 'primary' } as ReadPreference;
  }

  readPreferenceFromOptions(): ReadPreference {
    return this.getReadPreference();
  }

  getReadConcern(): ReadConcern | undefined {
    return undefined;
  }

  getWriteConcern(): WriteConcern | undefined {
    return undefined;
  }

  async resetConnectionOptions(): Promise<void> {
    /* no-op */
  }

  startSession(): { endSession: () => Promise<void> } {
    return {
      endSession: async () => undefined,
    };
  }

  getRawClient(): undefined {
    return undefined;
  }
}
