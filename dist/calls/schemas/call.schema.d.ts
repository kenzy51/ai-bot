import { Document } from 'mongoose';
export declare class Call extends Document {
    businessId: string;
    patientPhone: string;
    patientName: string;
    summary: string;
    transcript: string;
    status: string;
    procedure: string;
    callSid: string;
    recordingUrl: string;
    callDuration: number;
    metadata: {
        latency: number;
        modelUsed: string;
    };
    isFlagged: boolean;
}
export declare const CallSchema: import("mongoose").Schema<Call, import("mongoose").Model<Call, any, any, any, (Document<unknown, any, Call, any, import("mongoose").DefaultSchemaOptions> & Call & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | (Document<unknown, any, Call, any, import("mongoose").DefaultSchemaOptions> & Call & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}), any, Call>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Call, Document<unknown, {}, Call, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<Call & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<import("mongoose").Types.ObjectId, Call, Document<unknown, {}, Call, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Call & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    businessId?: import("mongoose").SchemaDefinitionProperty<string, Call, Document<unknown, {}, Call, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Call & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    patientPhone?: import("mongoose").SchemaDefinitionProperty<string, Call, Document<unknown, {}, Call, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Call & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    patientName?: import("mongoose").SchemaDefinitionProperty<string, Call, Document<unknown, {}, Call, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Call & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    summary?: import("mongoose").SchemaDefinitionProperty<string, Call, Document<unknown, {}, Call, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Call & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    transcript?: import("mongoose").SchemaDefinitionProperty<string, Call, Document<unknown, {}, Call, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Call & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<string, Call, Document<unknown, {}, Call, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Call & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    procedure?: import("mongoose").SchemaDefinitionProperty<string, Call, Document<unknown, {}, Call, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Call & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    callSid?: import("mongoose").SchemaDefinitionProperty<string, Call, Document<unknown, {}, Call, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Call & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    recordingUrl?: import("mongoose").SchemaDefinitionProperty<string, Call, Document<unknown, {}, Call, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Call & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    callDuration?: import("mongoose").SchemaDefinitionProperty<number, Call, Document<unknown, {}, Call, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Call & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    metadata?: import("mongoose").SchemaDefinitionProperty<{
        latency: number;
        modelUsed: string;
    }, Call, Document<unknown, {}, Call, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Call & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    isFlagged?: import("mongoose").SchemaDefinitionProperty<boolean, Call, Document<unknown, {}, Call, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Call & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, Call>;
