const { gql } = require('apollo-server-express');

const typeDefs = gql`
  scalar Date

  type User {
    id: ID!
    username: String!
    email: String!
    firstName: String
    lastName: String
    profilePicture: String
    bio: String
    role: String
    createdAt: Date
  }

  type Post {
    id: ID!
    content: String!
    author: User!
    images: [String]
    tags: [String]
    likes: [ID]
    likeCount: Int
    commentCount: Int
    visibility: String
    createdAt: Date
    comments(limit: Int): [Comment]
  }

  type Comment {
    id: ID!
    content: String!
    author: User!
    post: ID!
    createdAt: Date
  }

  type Query {
    me: User
    getUser(id: ID!): User
    getPosts(page: Int, limit: Int): [Post]
    getPost(id: ID!): Post
    getFeed(page: Int, limit: Int): [Post]
  }

  type Mutation {
    createPost(content: String!, tags: [String], visibility: String, images: [String]): Post
    deletePost(id: ID!): Boolean
    likePost(id: ID!): Boolean
    addComment(postId: ID!, content: String!): Comment
  }
`;

module.exports = typeDefs;
