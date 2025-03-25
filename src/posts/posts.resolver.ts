import { PrismaService } from 'nestjs-prisma';
import {
  Resolver,
  Query,
  Parent,
  Args,
  ResolveField,
  Subscription,
  Mutation,
} from '@nestjs/graphql';
import { findManyCursorConnection } from '@devoxa/prisma-relay-cursor-connection';
import { PubSub } from 'graphql-subscriptions';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { PaginationArgs } from '../common/pagination/pagination.args';
import { UserEntity } from '../common/decorators/user.decorator';
import { User } from '../users/models/user.model';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { PostIdArgs } from './args/post-id.args';
import { UserIdArgs } from './args/user-id.args';
import { Post } from './models/post.model';
import { PostConnection } from './models/post-connection.model';
import { PostOrder } from './dto/post-order.input';
import { CreatePostInput } from './dto/createPost.input';
import { Like } from './models/like.model';
import { LikeConnection } from './models/like-connection.model';
import { LikeCount } from './models/like-count.model';

const pubSub = new PubSub();

@Resolver(() => Post)
export class PostsResolver {
  constructor(private prisma: PrismaService) {}

  @Subscription(() => Post)
  postCreated() {
    return pubSub.asyncIterator('postCreated');
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Post)
  async createPost(
    @UserEntity() user: User,
    @Args('data') data: CreatePostInput,
  ) {
    const newPost = this.prisma.post.create({
      data: {
        published: true,
        title: data.title,
        content: data.content,
        authorId: user.id,
      },
    });
    pubSub.publish('postCreated', { postCreated: newPost });
    return newPost;
  }

  @Query(() => PostConnection)
  async publishedPosts(
    @Args() { after, before, first, last }: PaginationArgs,
    @Args({ name: 'query', type: () => String, nullable: true })
    query: string,
    @Args({
      name: 'orderBy',
      type: () => PostOrder,
      nullable: true,
    })
    orderBy: PostOrder,
  ) {
    const a = await findManyCursorConnection(
      (args) =>
        this.prisma.post.findMany({
          include: { author: true },
          where: {
            published: true,
            title: { contains: query || '' },
          },
          orderBy: orderBy ? { [orderBy.field]: orderBy.direction } : undefined,
          ...args,
        }),
      () =>
        this.prisma.post.count({
          where: {
            published: true,
            title: { contains: query || '' },
          },
        }),
      { first, last, before, after },
    );
    return a;
  }

  @Query(() => [Post])
  userPosts(@Args() id: UserIdArgs) {
    return this.prisma.user
      .findUnique({ where: { id: id.userId } })
      .posts({ where: { published: true } });

    // or
    // return this.prisma.posts.findMany({
    //   where: {
    //     published: true,
    //     author: { id: id.userId }
    //   }
    // });
  }

  @Query(() => Post)
  async post(@Args() id: PostIdArgs) {
    return this.prisma.post.findUnique({ where: { id: id.postId } });
  }

  @ResolveField('author', () => User)
  async author(@Parent() post: Post) {
    return this.prisma.post.findUnique({ where: { id: post.id } }).author();
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => LikeCount)
  async likePost(@UserEntity() user: User, @Args() args: PostIdArgs) {
    const post = await this.prisma.post.findFirst({
      where: { id: args.postId, published: true },
      select: {
        id: true,
        likes: {
          where: { userId: user.id },
          select: { userId: true },
        },
      },
    });

    if (!post) {
      throw new BadRequestException('Post not found!');
    }

    if (post.likes?.length) {
      throw new BadRequestException('Post has already been liked!');
    }

    await this.prisma.like.create({
      data: {
        postId: post.id,
        userId: user.id,
      },
    });

    const count = await this.prisma.like.count({
      where: {
        postId: post.id,
      },
    });

    return new LikeCount(count);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => LikeCount)
  async unLikePost(@UserEntity() user: User, @Args() args: PostIdArgs) {
    const post = await this.prisma.post.findFirst({
      where: { id: args.postId, published: true },
      select: {
        id: true,
        likes: {
          where: { userId: user.id },
          select: { userId: true },
        },
      },
    });

    if (!post) {
      throw new BadRequestException('Post not found!');
    }

    if (!post.likes?.length) {
      throw new BadRequestException('Post has not been liked!');
    }

    await this.prisma.like.delete({
      where: {
        userId_postId: {
          userId: user.id,
          postId: post.id,
        },
      },
    });

    const count = await this.prisma.like.count({
      where: {
        postId: post.id,
      },
    });

    return new LikeCount(count);
  }

  @Query(() => LikeConnection)
  async getPostLikes(
    @Args() id: PostIdArgs,
    @Args() { after, before, first, last }: PaginationArgs,
  ) {
    const post = await this.prisma.post.findUnique({
      where: { id: id.postId },
    });

    if (!post) {
      throw new BadRequestException('Post not found!');
    }

    const likes = await findManyCursorConnection(
      (args) =>
        this.prisma.like.findMany({
          where: {
            postId: post.id,
          },
          select: {
            id: true,
            postId: true,
            user: {
              select: {
                id: true,
                firstname: true,
                lastname: true,
                email: true,
              },
            },
          },
          ...args,
        }),
      () =>
        this.prisma.like.count({
          where: {
            postId: post.id,
          },
        }),
      { first, last, before, after },
    );

    return likes;
  }
}
