import { Field, ObjectType } from '@nestjs/graphql';
import { BaseModel } from '../../common/models/base.model';
import { User } from '../../users/models/user.model';

@ObjectType()
export class Like extends BaseModel {
  @Field()
  userId: string;

  @Field()
  postId: string;

  @Field(() => User, { nullable: true })
  user?: User;
}
