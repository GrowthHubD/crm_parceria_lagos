import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  integer,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./users";
import { tenant } from "./tenants";

// ============================================
// BLOG INTERNAL
// ============================================

export const blogCategory = pgTable("blog_category", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  parentId: uuid("parent_id"), // NULL = root category, filled = subcategory (self-ref set via relation)
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const blogPost = pgTable(
  "blog_post",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    content: text("content").notNull(), // Markdown content
    excerpt: text("excerpt"),
    type: text("type").notNull().default("article"), // 'list', 'article', 'guide', 'study'
    coverImageUrl: text("cover_image_url"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => blogCategory.id),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    isPublished: boolean("is_published").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_blog_post_category").on(table.categoryId),
    index("idx_blog_post_published").on(table.isPublished, table.publishedAt),
  ]
);

export const blogPostTag = pgTable("blog_post_tag", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const blogPostTagAssignment = pgTable(
  "blog_post_tag_assignment",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => blogPost.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => blogPostTag.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.tagId] }),
  ]
);

export const blogCategoryPermission = pgTable("blog_category_permission", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => blogCategory.id, { onDelete: "cascade" }),
  canView: boolean("can_view").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// Relations
// ============================================

export const blogCategoryRelations = relations(blogCategory, ({ one, many }) => ({
  tenant: one(tenant, { fields: [blogCategory.tenantId], references: [tenant.id] }),
  parent: one(blogCategory, {
    fields: [blogCategory.parentId],
    references: [blogCategory.id],
    relationName: "categoryHierarchy",
  }),
  children: many(blogCategory, { relationName: "categoryHierarchy" }),
  posts: many(blogPost),
  permissions: many(blogCategoryPermission),
}));

export const blogPostRelations = relations(blogPost, ({ one, many }) => ({
  category: one(blogCategory, {
    fields: [blogPost.categoryId],
    references: [blogCategory.id],
  }),
  author: one(user, {
    fields: [blogPost.authorId],
    references: [user.id],
  }),
  tags: many(blogPostTagAssignment),
}));

export const blogPostTagAssignmentRelations = relations(blogPostTagAssignment, ({ one }) => ({
  post: one(blogPost, {
    fields: [blogPostTagAssignment.postId],
    references: [blogPost.id],
  }),
  tag: one(blogPostTag, {
    fields: [blogPostTagAssignment.tagId],
    references: [blogPostTag.id],
  }),
}));

export const blogCategoryPermissionRelations = relations(blogCategoryPermission, ({ one }) => ({
  user: one(user, {
    fields: [blogCategoryPermission.userId],
    references: [user.id],
  }),
  category: one(blogCategory, {
    fields: [blogCategoryPermission.categoryId],
    references: [blogCategory.id],
  }),
}));
