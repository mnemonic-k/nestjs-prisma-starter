import { ObjectType } from '@nestjs/graphql';
import PaginatedResponse from '../../common/pagination/pagination';
import { Like } from './like.model';

@ObjectType()
export class LikeConnection extends PaginatedResponse(Like) {}
