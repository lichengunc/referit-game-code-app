import argparse
import json
import sys
import os.path as osp
import random
random.seed(8)

def main(params):

    dataset = params['dataset']
    splitBy = params['splitBy']
    split   = params['split']
    output_txt = params['output_txt']

    # load refer
    sys.path.insert(0, 'refer')
    from refer import REFER
    refer = REFER('data', dataset, splitBy)

    # get refs that within the indicate split
    refs = []
    for ref_id, ref in refer.Refs.items():
        if split in ref['split']:
            # as long as ref['split'] contains string of split, e.g., testA or testB (contains 'test')
            refs += [ref]
    random.shuffle(refs)

    # write object's image paths
    txt_file = open(output_txt, 'w')
    for ref in refs:
        ref_img_path = ref['file_name']
        txt_file.write(ref_img_path+'\n')

    txt_file.close()
    print '%s refs\' filenames written in %s.' % (len(refs), output_txt)


if __name__ == '__main__':

    parser = argparse.ArgumentParser()
    # input json
    parser.add_argument('--output_txt', default='../NewestOrder.txt', help='output txt file for objects to be collected')
    parser.add_argument('--dataset', default='refcoco+', help='refcoco/refcoco+/refcocog')
    parser.add_argument('--splitBy', default='unc', help='unc/google/berkeley')
    parser.add_argument('--split', default='test', help='we will consider all splits containing the string, e.g., test -> testA & testB')
    # argparse
    args = parser.parse_args()
    params = vars(args)
    print 'parsed input parameters:'
    print json.dumps(params, indent=2)

    # call main
    main(params)


