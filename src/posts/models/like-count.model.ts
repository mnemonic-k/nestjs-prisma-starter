import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class LikeCount {
  constructor(count: number) {
    this.likeCount = count;
  }

  @Field(() => Number)
  likeCount: number;
}
