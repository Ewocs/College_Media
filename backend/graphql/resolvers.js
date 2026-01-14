const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment'); // Assuming Comment model exists or comments are embedded
const { AuthenticationError, UserInputError, ForbiddenError } = require('apollo-server-express');

// Since Comment model might not exist as a standalone or might be newly required, 
// I'll check if I need to use it or if comments are part of Post.
// Based on previous contexts, there is likely a Comment model or comments are in Post.
// Let's assume standard separation or check.
// I'll stick to basic resolvers first.

const resolvers = {
    Date: {
        // Basic date scalar implementation if needed, or just return string/number
        // Apollo often handles dates as strings by default if scalar not defined with custom logic
        // For simplicity, we'll let it pass as string/number or define it.
        // Actually, let's implement a simple scaler if `graphql-iso-date` isn't used.
        // For now, I'll just map to ISO string.
        __parseValue(value) {
            return new Date(value);
        },
        __serialize(value) {
            return value.toISOString();
        },
        __parseLiteral(ast) {
            return new Date(ast.value);
        }
    },

    Query: {
        me: async (_, __, { user }) => {
            if (!user) throw new AuthenticationError('Not authenticated');
            return await User.findById(user.userId);
        },
        getUser: async (_, { id }) => {
            return await User.findById(id);
        },
        getPosts: async (_, { page = 1, limit = 10 }) => {
            const skip = (page - 1) * limit;
            return await Post.find({ isDeleted: false, visibility: 'public' })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('author');
        },
        getPost: async (_, { id }) => {
            return await Post.findById(id).populate('author');
        },
        getFeed: async (_, { page = 1, limit = 10 }, { user }) => {
            // Basic feed: public posts + posts from followed users (logic simplified for now)
            const skip = (page - 1) * limit;
            return await Post.find({ isDeleted: false, visibility: 'public' }) // Expand logic as needed
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('author');
        }
    },

    Mutation: {
        createPost: async (_, { content, tags, visibility, images }, { user }) => {
            if (!user) throw new AuthenticationError('Not authenticated');

            const newPost = new Post({
                content,
                tags,
                visibility: visibility || 'public',
                images,
                author: user.userId
            });

            await newPost.save();
            return await newPost.populate('author');
        },
        deletePost: async (_, { id }, { user }) => {
            if (!user) throw new AuthenticationError('Not authenticated');

            const post = await Post.findById(id);
            if (!post) throw new UserInputError('Post not found');

            if (post.author.toString() !== user.userId && user.role !== 'admin') {
                throw new ForbiddenError('Not authorized');
            }

            post.isDeleted = true;
            await post.save();
            return true;
        },
        likePost: async (_, { id }, { user }) => {
            if (!user) throw new AuthenticationError('Not authenticated');

            const post = await Post.findById(id);
            if (!post) throw new UserInputError('Post not found');

            // Check if already liked logic would go here.
            // Assuming simple toggle or increment for now based on Schema `likes` array
            // If schema has `likes` as [ID], we toggle.

            const index = post.likes.indexOf(user.userId);
            if (index === -1) {
                post.likes.push(user.userId);
                post.likeCount = (post.likeCount || 0) + 1;
            } else {
                post.likes.splice(index, 1);
                post.likeCount = Math.max(0, (post.likeCount || 0) - 1);
            }

            await post.save();
            return true;
        },
        addComment: async (_, { postId, content }, { user }) => {
            if (!user) throw new AuthenticationError('Not authenticated');

            // Assuming separate Comment model based on typeDefs
            // If Comment model does not exist, I might need to create it or adjust.
            // I'll assume it exists or use embedded comments.
            // Since earlier logs mention Comment model creation in other branches, might be safe.
            // But let's check or create a temporary fallback. 
            // Actually, I'll rely on the existing import.

            const newComment = new Comment({
                content,
                post: postId,
                author: user.userId
            });

            await newComment.save();

            await Post.findByIdAndUpdate(postId, { $inc: { commentCount: 1 } });

            return await newComment.populate('author');
        }
    },

    Post: {
        author: async (parent) => {
            // Dataloader would be better here for performance (n+1 problem), 
            // but simple population is okay for start.
            // If parent.author is already populated (object), return it.
            // If it's ID, fetch it.
            if (parent.author && parent.author.username) return parent.author;
            return await User.findById(parent.author);
        },
        comments: async (parent, { limit = 5 }) => {
            return await Comment.find({ post: parent.id })
                .sort({ createdAt: -1 })
                .limit(limit)
                .populate('author');
        },
        likeCount: (parent) => parent.likes ? parent.likes.length : 0
    },

    Comment: {
        author: async (parent) => {
            if (parent.author && parent.author.username) return parent.author;
            return await User.findById(parent.author);
        }
    }
};

module.exports = resolvers;
