import { ArgsType, Field } from '@nestjs/graphql';
import { IsNotEmpty } from 'class-validator';

@ArgsType()
export class PostIdArgs {
  @Field()
  @IsNotEmpty()
  postId: string;
}
